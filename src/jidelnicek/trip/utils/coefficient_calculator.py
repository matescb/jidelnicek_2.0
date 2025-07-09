"""
Coefficient calculation engine for trip participants.

This module provides utilities for calculating effective participant counts
based on meal-specific coefficients, supporting scenarios like:
- Participants with different coefficients per meal type
- Partial trip attendance (arriving/leaving on specific days)
- Aggregated calculations for shopping lists and meal planning
"""

from datetime import date, datetime
from typing import Dict, List, Optional, Tuple, Set
from uuid import UUID
from decimal import Decimal
from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from jidelnicek.trip.models.trip import Trip
from jidelnicek.trip.models.participant import TripParticipant
from jidelnicek.trip.models.day import TripDay
from jidelnicek.trip.models.meal import TripMeal


@dataclass
class ParticipantCoefficient:
    """Container for participant meal coefficients."""
    participant_id: UUID
    participant_name: str
    meal_slot: str
    coefficient: Decimal
    
    @property
    def effective_coefficient(self) -> float:
        """Get coefficient as percentage (e.g., 100.0 = 100%)."""
        return float(self.coefficient)


@dataclass
class MealParticipantSummary:
    """Summary of participants for a specific meal."""
    day_id: UUID
    day_number: int
    date: date
    meal_slot: str
    participant_count: int
    effective_count: Decimal
    participants: List[Dict[str, any]]


@dataclass
class DailyParticipantSummary:
    """Summary of participants for a specific day."""
    day_id: UUID
    day_number: int
    date: date
    total_participants: int
    meal_summaries: Dict[str, MealParticipantSummary]
    
    @property
    def average_effective_count(self) -> Decimal:
        """Calculate average effective count across all meals."""
        if not self.meal_summaries:
            return Decimal('0')
        
        total = sum(summary.effective_count for summary in self.meal_summaries.values())
        return total / len(self.meal_summaries)


@dataclass
class TripCoefficientSummary:
    """Overall coefficient summary for a trip."""
    trip_id: UUID
    total_participants: int
    daily_summaries: List[DailyParticipantSummary]
    meal_slot_totals: Dict[str, Decimal]
    
    @property
    def total_effective_days(self) -> Decimal:
        """Calculate total effective participant-days."""
        return sum(
            summary.average_effective_count 
            for summary in self.daily_summaries
        )


class CoefficientCalculator:
    """
    Calculator for participant coefficients in trip meal planning.
    
    Handles complex scenarios including:
    - Per-meal-type coefficients
    - Partial attendance (date ranges)
    - Aggregated calculations for shopping lists
    """
    
    def __init__(self, session: AsyncSession):
        """
        Initialize coefficient calculator.
        
        Args:
            session: Database session for queries
        """
        self.session = session
        self._coefficient_cache: Dict[Tuple[UUID, UUID, str], Decimal] = {}
    
    async def get_participant_coefficients(
        self,
        trip_id: UUID,
        participant_id: Optional[UUID] = None,
        meal_slot: Optional[str] = None
    ) -> List[ParticipantCoefficient]:
        """
        Get participant coefficients for a trip.
        
        Args:
            trip_id: Trip ID
            participant_id: Optional specific participant
            meal_slot: Optional specific meal slot
            
        Returns:
            List of participant coefficients
        """
        # Get trip with participants
        query = select(Trip).where(Trip.id == trip_id).options(
            selectinload(Trip.participants)
        )
        result = await self.session.execute(query)
        trip = result.scalar_one_or_none()
        
        if not trip:
            return []
        
        coefficients = []
        
        for participant in trip.participants:
            if participant_id and participant.id != participant_id:
                continue
            
            # Get meal slots from trip configuration
            meal_slots = trip.meal_slots or ['Breakfast', 'Lunch', 'Dinner']
            
            for slot in meal_slots:
                if meal_slot and slot != meal_slot:
                    continue
                
                # Get coefficient for this participant and meal slot
                coeff = await self._get_meal_coefficient(
                    participant.id,
                    trip_id,
                    slot
                )
                
                coefficients.append(ParticipantCoefficient(
                    participant_id=participant.id,
                    participant_name=participant.display_name,
                    meal_slot=slot,
                    coefficient=coeff
                ))
        
        return coefficients
    
    async def _get_meal_coefficient(
        self,
        participant_id: UUID,
        trip_id: UUID,
        meal_slot: str
    ) -> Decimal:
        """
        Get coefficient for a specific participant and meal slot.
        
        First checks for meal-specific coefficients, then falls back
        to the base coefficient from the participant.
        
        Args:
            participant_id: Participant ID
            trip_id: Trip ID
            meal_slot: Meal slot name
            
        Returns:
            Coefficient value
        """
        cache_key = (participant_id, trip_id, meal_slot)
        
        if cache_key in self._coefficient_cache:
            return self._coefficient_cache[cache_key]
        
        # First, try to get meal-specific coefficient
        # Note: This is prepared for future use when TripMealCoefficient is implemented
        try:
            from jidelnicek.trip.models.meal_coefficient import TripMealCoefficient
            
            meal_coeff_query = select(TripMealCoefficient.coefficient).where(
                and_(
                    TripMealCoefficient.participant_id == participant_id,
                    TripMealCoefficient.meal_slot == meal_slot
                )
            )
            result = await self.session.execute(meal_coeff_query)
            meal_coefficient = result.scalar_one_or_none()
            
            if meal_coefficient is not None:
                self._coefficient_cache[cache_key] = meal_coefficient
                return meal_coefficient
        except ImportError:
            # TripMealCoefficient not yet implemented, fall through to base coefficient
            pass
        
        # Fall back to base coefficient from participant
        query = select(TripParticipant.coefficient).where(
            and_(
                TripParticipant.id == participant_id,
                TripParticipant.trip_id == trip_id
            )
        )
        result = await self.session.execute(query)
        coefficient = result.scalar_one_or_none()
        
        if coefficient is None:
            coefficient = Decimal('100.00')
        
        self._coefficient_cache[cache_key] = coefficient
        return coefficient
    
    async def calculate_meal_participants(
        self,
        trip_id: UUID,
        day_id: UUID,
        meal_slot: str,
        attendance_dates: Optional[Dict[UUID, Tuple[date, date]]] = None
    ) -> MealParticipantSummary:
        """
        Calculate effective participant count for a specific meal.
        
        Args:
            trip_id: Trip ID
            day_id: Day ID
            meal_slot: Meal slot name
            attendance_dates: Optional dict of participant attendance ranges
            
        Returns:
            Meal participant summary
        """
        # Get day and trip info
        day_query = select(TripDay).where(TripDay.id == day_id).options(
            selectinload(TripDay.trip).selectinload(Trip.participants)
        )
        result = await self.session.execute(day_query)
        day = result.scalar_one_or_none()
        
        if not day:
            return MealParticipantSummary(
                day_id=day_id,
                day_number=0,
                date=date.today(),
                meal_slot=meal_slot,
                participant_count=0,
                effective_count=Decimal('0'),
                participants=[]
            )
        
        participants_data = []
        effective_count = Decimal('0')
        participant_count = 0
        
        for participant in day.trip.participants:
            # Check attendance if provided
            if attendance_dates and participant.id in attendance_dates:
                start_date, end_date = attendance_dates[participant.id]
                if not (start_date <= day.date <= end_date):
                    continue
            
            # Get coefficient for this meal
            coefficient = await self._get_meal_coefficient(
                participant.id,
                trip_id,
                meal_slot
            )
            
            participants_data.append({
                'id': participant.id,
                'name': participant.display_name,
                'coefficient': float(coefficient),
                'effective_portion': float(coefficient) / 100.0
            })
            
            effective_count += coefficient / Decimal('100')
            participant_count += 1
        
        return MealParticipantSummary(
            day_id=day_id,
            day_number=day.day_number,
            date=day.date,
            meal_slot=meal_slot,
            participant_count=participant_count,
            effective_count=effective_count,
            participants=participants_data
        )
    
    async def calculate_daily_participants(
        self,
        trip_id: UUID,
        day_id: UUID,
        attendance_dates: Optional[Dict[UUID, Tuple[date, date]]] = None
    ) -> DailyParticipantSummary:
        """
        Calculate participant summary for a specific day.
        
        Args:
            trip_id: Trip ID
            day_id: Day ID
            attendance_dates: Optional dict of participant attendance ranges
            
        Returns:
            Daily participant summary
        """
        # Get day with trip info
        day_query = select(TripDay).where(TripDay.id == day_id).options(
            selectinload(TripDay.trip)
        )
        result = await self.session.execute(day_query)
        day = result.scalar_one_or_none()
        
        if not day:
            return DailyParticipantSummary(
                day_id=day_id,
                day_number=0,
                date=date.today(),
                total_participants=0,
                meal_summaries={}
            )
        
        meal_summaries = {}
        meal_slots = day.trip.meal_slots or ['Breakfast', 'Lunch', 'Dinner']
        
        for meal_slot in meal_slots:
            summary = await self.calculate_meal_participants(
                trip_id=trip_id,
                day_id=day_id,
                meal_slot=meal_slot,
                attendance_dates=attendance_dates
            )
            meal_summaries[meal_slot] = summary
        
        # Get unique participants for the day
        unique_participants = set()
        for summary in meal_summaries.values():
            for participant in summary.participants:
                unique_participants.add(participant['id'])
        
        return DailyParticipantSummary(
            day_id=day_id,
            day_number=day.day_number,
            date=day.date,
            total_participants=len(unique_participants),
            meal_summaries=meal_summaries
        )
    
    async def calculate_trip_summary(
        self,
        trip_id: UUID,
        attendance_dates: Optional[Dict[UUID, Tuple[date, date]]] = None
    ) -> TripCoefficientSummary:
        """
        Calculate overall coefficient summary for a trip.
        
        Args:
            trip_id: Trip ID
            attendance_dates: Optional dict of participant attendance ranges
            
        Returns:
            Trip coefficient summary
        """
        # Get trip with all related data
        trip_query = select(Trip).where(Trip.id == trip_id).options(
            selectinload(Trip.participants),
            selectinload(Trip.days)
        )
        result = await self.session.execute(trip_query)
        trip = result.scalar_one_or_none()
        
        if not trip:
            return TripCoefficientSummary(
                trip_id=trip_id,
                total_participants=0,
                daily_summaries=[],
                meal_slot_totals={}
            )
        
        daily_summaries = []
        meal_slot_totals = defaultdict(Decimal)
        
        # Process each day
        for day in sorted(trip.days, key=lambda d: d.day_number):
            daily_summary = await self.calculate_daily_participants(
                trip_id=trip_id,
                day_id=day.id,
                attendance_dates=attendance_dates
            )
            daily_summaries.append(daily_summary)
            
            # Accumulate meal slot totals
            for meal_slot, meal_summary in daily_summary.meal_summaries.items():
                meal_slot_totals[meal_slot] += meal_summary.effective_count
        
        return TripCoefficientSummary(
            trip_id=trip_id,
            total_participants=len(trip.participants),
            daily_summaries=daily_summaries,
            meal_slot_totals=dict(meal_slot_totals)
        )
    
    async def calculate_shopping_quantities(
        self,
        trip_id: UUID,
        base_quantity: Decimal,
        meal_slots: Optional[List[str]] = None,
        attendance_dates: Optional[Dict[UUID, Tuple[date, date]]] = None
    ) -> Dict[str, Decimal]:
        """
        Calculate shopping quantities based on effective participant counts.
        
        Args:
            trip_id: Trip ID
            base_quantity: Base quantity per person
            meal_slots: Optional list of meal slots to consider
            attendance_dates: Optional dict of participant attendance ranges
            
        Returns:
            Dict of meal slot to total quantity needed
        """
        summary = await self.calculate_trip_summary(trip_id, attendance_dates)
        
        quantities = {}
        for meal_slot, total_effective in summary.meal_slot_totals.items():
            if meal_slots and meal_slot not in meal_slots:
                continue
            
            quantities[meal_slot] = base_quantity * total_effective
        
        return quantities
    
    def clear_cache(self):
        """Clear the coefficient cache."""
        self._coefficient_cache.clear()