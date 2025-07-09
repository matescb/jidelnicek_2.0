"""
Trip meal slot service.

This module provides business logic for managing trip meal slots.
"""

from typing import List, Optional, Dict
from uuid import UUID
from collections import defaultdict

from sqlalchemy import select, func, and_, or_, exists
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from jidelnicek.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError
)
from jidelnicek.trip.models import Trip, TripDay, TripMealSlot
from jidelnicek.trip.schemas.meal_slot import (
    MealSlotCreate,
    MealSlotUpdate,
    MealSlot,
    DayMealSlots,
    TripMealPattern,
    MealSlotBulkCreate
)


class MealSlotService:
    """
    Service for managing trip meal slots.
    
    Provides functionality for:
    - Creating and managing meal slot configurations
    - Setting up default meal patterns for trips
    - Customizing meal slots per day
    - Analyzing meal patterns across trips
    """
    
    def __init__(self, session: AsyncSession):
        """Initialize meal slot service."""
        self.session = session
    
    async def create_default_meal_slots(
        self,
        trip_id: UUID,
        meal_types: Optional[List[str]] = None
    ) -> List[MealSlot]:
        """
        Create default meal slots for all days in a trip.
        
        Args:
            trip_id: Trip ID
            meal_types: List of meal types (defaults to Breakfast, Lunch, Dinner)
            
        Returns:
            List of created meal slots
            
        Raises:
            NotFoundError: If trip not found
        """
        if meal_types is None:
            meal_types = ["Breakfast", "Lunch", "Dinner"]
        
        # Get trip with days
        stmt = select(Trip).options(
            selectinload(Trip.days)
        ).where(Trip.id == trip_id)
        result = await self.session.execute(stmt)
        trip = result.scalar_one_or_none()
        
        if not trip:
            raise NotFoundError(f"Trip {trip_id} not found")
        
        # Create meal slots for each day
        meal_slots = []
        for day in trip.days:
            for order, meal_type in enumerate(meal_types, 1):
                slot = TripMealSlot(
                    trip_id=trip_id,
                    day_id=day.id,
                    day_number=day.day_number,
                    meal_type=meal_type,
                    is_active=True,
                    display_order=order
                )
                self.session.add(slot)
                meal_slots.append(slot)
        
        await self.session.commit()
        
        # Refresh and return
        for slot in meal_slots:
            await self.session.refresh(slot)
        
        return [MealSlot.model_validate(slot) for slot in meal_slots]
    
    async def create_meal_slot(
        self,
        trip_id: UUID,
        meal_slot_data: MealSlotCreate
    ) -> MealSlot:
        """
        Create a single meal slot.
        
        Args:
            trip_id: Trip ID
            meal_slot_data: Meal slot creation data
            
        Returns:
            Created meal slot
            
        Raises:
            NotFoundError: If trip or day not found
            ConflictError: If meal slot already exists for day/type
        """
        # Get trip day
        day_stmt = select(TripDay).where(
            and_(
                TripDay.trip_id == trip_id,
                TripDay.day_number == meal_slot_data.day_number
            )
        )
        result = await self.session.execute(day_stmt)
        day = result.scalar_one_or_none()
        
        if not day:
            raise NotFoundError(
                f"Day {meal_slot_data.day_number} not found in trip {trip_id}"
            )
        
        # Check if meal slot already exists
        exists_stmt = select(exists().where(
            and_(
                TripMealSlot.trip_id == trip_id,
                TripMealSlot.day_number == meal_slot_data.day_number,
                func.lower(TripMealSlot.meal_type) == meal_slot_data.meal_type.lower()
            )
        ))
        result = await self.session.execute(exists_stmt)
        if result.scalar():
            raise ConflictError(
                f"Meal slot '{meal_slot_data.meal_type}' already exists "
                f"for day {meal_slot_data.day_number}"
            )
        
        # Create meal slot
        meal_slot = TripMealSlot(
            trip_id=trip_id,
            day_id=day.id,
            day_number=day.day_number,
            meal_type=meal_slot_data.meal_type,
            is_active=meal_slot_data.is_active,
            custom_name=meal_slot_data.custom_name,
            display_order=meal_slot_data.display_order
        )
        
        self.session.add(meal_slot)
        await self.session.commit()
        await self.session.refresh(meal_slot)
        
        return MealSlot.model_validate(meal_slot)
    
    async def create_meal_slots_bulk(
        self,
        trip_id: UUID,
        bulk_data: MealSlotBulkCreate
    ) -> List[MealSlot]:
        """
        Create multiple meal slots at once.
        
        Args:
            trip_id: Trip ID
            bulk_data: Bulk creation data
            
        Returns:
            List of created meal slots
            
        Raises:
            NotFoundError: If trip or days not found
            ConflictError: If any meal slot already exists
        """
        # Get all required days
        day_numbers = {slot.day_number for slot in bulk_data.meal_slots}
        
        days_stmt = select(TripDay).where(
            and_(
                TripDay.trip_id == trip_id,
                TripDay.day_number.in_(day_numbers)
            )
        )
        result = await self.session.execute(days_stmt)
        days = result.scalars().all()
        
        if len(days) != len(day_numbers):
            found_numbers = {day.day_number for day in days}
            missing = day_numbers - found_numbers
            raise NotFoundError(f"Days not found: {sorted(missing)}")
        
        # Create day lookup
        day_map = {day.day_number: day for day in days}
        
        # Check for existing meal slots
        existing_stmt = select(
            TripMealSlot.day_number,
            TripMealSlot.meal_type
        ).where(TripMealSlot.trip_id == trip_id)
        
        result = await self.session.execute(existing_stmt)
        existing = {
            (row.day_number, row.meal_type.lower())
            for row in result
        }
        
        # Check for conflicts
        conflicts = []
        for slot_data in bulk_data.meal_slots:
            key = (slot_data.day_number, slot_data.meal_type.lower())
            if key in existing:
                conflicts.append(f"Day {slot_data.day_number}: {slot_data.meal_type}")
        
        if conflicts:
            raise ConflictError(
                f"Meal slots already exist: {', '.join(conflicts)}"
            )
        
        # Create all meal slots
        meal_slots = []
        for slot_data in bulk_data.meal_slots:
            day = day_map[slot_data.day_number]
            slot = TripMealSlot(
                trip_id=trip_id,
                day_id=day.id,
                day_number=day.day_number,
                meal_type=slot_data.meal_type,
                is_active=slot_data.is_active,
                custom_name=slot_data.custom_name,
                display_order=slot_data.display_order
            )
            self.session.add(slot)
            meal_slots.append(slot)
        
        await self.session.commit()
        
        # Refresh and return
        for slot in meal_slots:
            await self.session.refresh(slot)
        
        return [MealSlot.model_validate(slot) for slot in meal_slots]
    
    async def update_meal_slot(
        self,
        trip_id: UUID,
        meal_slot_id: UUID,
        update_data: MealSlotUpdate
    ) -> MealSlot:
        """
        Update a meal slot.
        
        Args:
            trip_id: Trip ID
            meal_slot_id: Meal slot ID
            update_data: Update data
            
        Returns:
            Updated meal slot
            
        Raises:
            NotFoundError: If meal slot not found
        """
        # Get meal slot
        stmt = select(TripMealSlot).where(
            and_(
                TripMealSlot.id == meal_slot_id,
                TripMealSlot.trip_id == trip_id
            )
        )
        result = await self.session.execute(stmt)
        meal_slot = result.scalar_one_or_none()
        
        if not meal_slot:
            raise NotFoundError(f"Meal slot {meal_slot_id} not found")
        
        # Update fields
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(meal_slot, field, value)
        
        await self.session.commit()
        await self.session.refresh(meal_slot)
        
        return MealSlot.model_validate(meal_slot)
    
    async def delete_meal_slot(
        self,
        trip_id: UUID,
        meal_slot_id: UUID
    ) -> None:
        """
        Delete a meal slot.
        
        Args:
            trip_id: Trip ID
            meal_slot_id: Meal slot ID
            
        Raises:
            NotFoundError: If meal slot not found
            ConflictError: If meal slot has associated meals
        """
        # Get meal slot with meals
        stmt = select(TripMealSlot).options(
            selectinload(TripMealSlot.meals)
        ).where(
            and_(
                TripMealSlot.id == meal_slot_id,
                TripMealSlot.trip_id == trip_id
            )
        )
        result = await self.session.execute(stmt)
        meal_slot = result.scalar_one_or_none()
        
        if not meal_slot:
            raise NotFoundError(f"Meal slot {meal_slot_id} not found")
        
        # Check if has meals
        if meal_slot.meals:
            raise ConflictError(
                f"Cannot delete meal slot with {len(meal_slot.meals)} assigned meals"
            )
        
        await self.session.delete(meal_slot)
        await self.session.commit()
    
    async def get_meal_slot(
        self,
        trip_id: UUID,
        meal_slot_id: UUID
    ) -> MealSlot:
        """
        Get a single meal slot.
        
        Args:
            trip_id: Trip ID
            meal_slot_id: Meal slot ID
            
        Returns:
            Meal slot
            
        Raises:
            NotFoundError: If meal slot not found
        """
        stmt = select(TripMealSlot).where(
            and_(
                TripMealSlot.id == meal_slot_id,
                TripMealSlot.trip_id == trip_id
            )
        )
        result = await self.session.execute(stmt)
        meal_slot = result.scalar_one_or_none()
        
        if not meal_slot:
            raise NotFoundError(f"Meal slot {meal_slot_id} not found")
        
        return MealSlot.model_validate(meal_slot)
    
    async def list_trip_meal_slots(
        self,
        trip_id: UUID,
        day_number: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> List[MealSlot]:
        """
        List meal slots for a trip.
        
        Args:
            trip_id: Trip ID
            day_number: Optional filter by day number
            is_active: Optional filter by active status
            
        Returns:
            List of meal slots
        """
        stmt = select(TripMealSlot).where(
            TripMealSlot.trip_id == trip_id
        ).order_by(
            TripMealSlot.day_number,
            TripMealSlot.display_order
        )
        
        if day_number is not None:
            stmt = stmt.where(TripMealSlot.day_number == day_number)
        
        if is_active is not None:
            stmt = stmt.where(TripMealSlot.is_active == is_active)
        
        result = await self.session.execute(stmt)
        meal_slots = result.scalars().all()
        
        return [MealSlot.model_validate(slot) for slot in meal_slots]
    
    async def get_meal_slots_by_day(
        self,
        trip_id: UUID
    ) -> List[DayMealSlots]:
        """
        Get meal slots grouped by day.
        
        Args:
            trip_id: Trip ID
            
        Returns:
            List of day meal slots
        """
        # Get trip days with meal slots
        stmt = select(TripDay).options(
            selectinload(TripDay.meal_slots)
        ).where(
            TripDay.trip_id == trip_id
        ).order_by(TripDay.day_number)
        
        result = await self.session.execute(stmt)
        days = result.scalars().all()
        
        # Group by day
        day_slots = []
        for day in days:
            meal_slots = sorted(
                day.meal_slots,
                key=lambda s: s.display_order
            )
            
            day_slots.append(DayMealSlots(
                day_number=day.day_number,
                day_id=day.id,
                date=day.date.isoformat(),
                meal_slots=[MealSlot.model_validate(slot) for slot in meal_slots],
                active_count=sum(1 for slot in meal_slots if slot.is_active)
            ))
        
        return day_slots
    
    async def get_trip_meal_pattern(
        self,
        trip_id: UUID
    ) -> TripMealPattern:
        """
        Get trip meal pattern analysis.
        
        Args:
            trip_id: Trip ID
            
        Returns:
            Trip meal pattern
            
        Raises:
            NotFoundError: If trip not found
        """
        # Get trip
        trip_stmt = select(Trip).where(Trip.id == trip_id)
        result = await self.session.execute(trip_stmt)
        trip = result.scalar_one_or_none()
        
        if not trip:
            raise NotFoundError(f"Trip {trip_id} not found")
        
        # Count meal slots
        stats_stmt = select(
            func.count(TripMealSlot.id).label('total'),
            func.count(TripMealSlot.id).filter(
                TripMealSlot.is_active == True
            ).label('active'),
            TripMealSlot.meal_type
        ).where(
            TripMealSlot.trip_id == trip_id
        ).group_by(TripMealSlot.meal_type)
        
        result = await self.session.execute(stats_stmt)
        stats = result.all()
        
        # Count days
        days_stmt = select(func.count(TripDay.id)).where(
            TripDay.trip_id == trip_id
        )
        result = await self.session.execute(days_stmt)
        total_days = result.scalar() or 0
        
        # Build summary
        meal_slot_summary = {}
        total_slots = 0
        active_slots = 0
        
        for row in stats:
            meal_slot_summary[row.meal_type] = row.total
            total_slots += row.total
            active_slots += row.active
        
        return TripMealPattern(
            trip_id=trip_id,
            default_meal_types=trip.meal_slots or ["Breakfast", "Lunch", "Dinner"],
            total_days=total_days,
            total_meal_slots=total_slots,
            active_meal_slots=active_slots,
            meal_slot_summary=meal_slot_summary
        )
    
    async def toggle_meal_slot(
        self,
        trip_id: UUID,
        meal_slot_id: UUID
    ) -> MealSlot:
        """
        Toggle meal slot active status.
        
        Args:
            trip_id: Trip ID
            meal_slot_id: Meal slot ID
            
        Returns:
            Updated meal slot
            
        Raises:
            NotFoundError: If meal slot not found
        """
        # Get meal slot
        stmt = select(TripMealSlot).where(
            and_(
                TripMealSlot.id == meal_slot_id,
                TripMealSlot.trip_id == trip_id
            )
        )
        result = await self.session.execute(stmt)
        meal_slot = result.scalar_one_or_none()
        
        if not meal_slot:
            raise NotFoundError(f"Meal slot {meal_slot_id} not found")
        
        # Toggle status
        meal_slot.is_active = not meal_slot.is_active
        
        await self.session.commit()
        await self.session.refresh(meal_slot)
        
        return MealSlot.model_validate(meal_slot)
    
    async def copy_meal_pattern(
        self,
        source_trip_id: UUID,
        target_trip_id: UUID
    ) -> List[MealSlot]:
        """
        Copy meal pattern from one trip to another.
        
        Args:
            source_trip_id: Source trip ID
            target_trip_id: Target trip ID
            
        Returns:
            List of created meal slots
            
        Raises:
            NotFoundError: If either trip not found
            ConflictError: If target trip already has meal slots
        """
        # Check target trip doesn't have meal slots
        exists_stmt = select(exists().where(
            TripMealSlot.trip_id == target_trip_id
        ))
        result = await self.session.execute(exists_stmt)
        if result.scalar():
            raise ConflictError("Target trip already has meal slots configured")
        
        # Get source meal slots
        source_slots = await self.list_trip_meal_slots(source_trip_id)
        
        if not source_slots:
            raise NotFoundError("Source trip has no meal slots to copy")
        
        # Get target trip days
        target_days_stmt = select(TripDay).where(
            TripDay.trip_id == target_trip_id
        )
        result = await self.session.execute(target_days_stmt)
        target_days = result.scalars().all()
        
        if not target_days:
            raise NotFoundError("Target trip has no days")
        
        # Create day map
        day_map = {day.day_number: day for day in target_days}
        
        # Group source slots by day
        slots_by_day = defaultdict(list)
        for slot in source_slots:
            slots_by_day[slot.day_number].append(slot)
        
        # Create new slots
        new_slots = []
        for day_num, day in day_map.items():
            # Use slots from same day number, or from day 1 as template
            template_slots = slots_by_day.get(day_num, slots_by_day.get(1, []))
            
            for template in template_slots:
                new_slot = TripMealSlot(
                    trip_id=target_trip_id,
                    day_id=day.id,
                    day_number=day.day_number,
                    meal_type=template.meal_type,
                    is_active=template.is_active,
                    custom_name=template.custom_name,
                    display_order=template.display_order
                )
                self.session.add(new_slot)
                new_slots.append(new_slot)
        
        await self.session.commit()
        
        # Refresh and return
        for slot in new_slots:
            await self.session.refresh(slot)
        
        return [MealSlot.model_validate(slot) for slot in new_slots]