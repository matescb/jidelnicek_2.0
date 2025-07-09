"""
Trip participant service.

This module provides business logic for managing trip participants.
"""

from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from jidelnicek.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError
)
from jidelnicek.trip.models import Trip, TripParticipant, TripDay
from jidelnicek.trip.schemas import (
    ParticipantCreate,
    ParticipantUpdate,
    Participant,
    DayParticipants
)


class ParticipantService:
    """Service for managing trip participants."""
    
    MAX_PARTICIPANTS = 20
    
    def __init__(self, session: AsyncSession):
        """Initialize the participant service."""
        self.session = session
    
    async def add_participant(
        self,
        trip_id: UUID,
        participant_data: ParticipantCreate
    ) -> Participant:
        """
        Add a participant to a trip.
        
        Args:
            trip_id: The trip ID
            participant_data: Participant creation data
            
        Returns:
            The created participant
            
        Raises:
            NotFoundError: If trip not found
            ConflictError: If participant limit exceeded
            ValidationError: If participant data invalid
        """
        # Get trip with participants
        stmt = select(Trip).options(
            selectinload(Trip.participants)
        ).where(Trip.id == trip_id)
        
        result = await self.session.execute(stmt)
        trip = result.scalar_one_or_none()
        
        if not trip:
            raise NotFoundError(f"Trip {trip_id} not found")
        
        # Check participant limit
        if len(trip.participants) >= self.MAX_PARTICIPANTS:
            raise ConflictError(
                f"Cannot add more than {self.MAX_PARTICIPANTS} participants to a trip"
            )
        
        # Validate attendance dates against trip dates
        if participant_data.arrival_date:
            if participant_data.arrival_date < trip.start_date:
                raise ValidationError("Arrival date cannot be before trip start date")
            if participant_data.arrival_date > trip.end_date:
                raise ValidationError("Arrival date cannot be after trip end date")
                
        if participant_data.departure_date:
            if participant_data.departure_date < trip.start_date:
                raise ValidationError("Departure date cannot be before trip start date")
            if participant_data.departure_date > trip.end_date:
                raise ValidationError("Departure date cannot be after trip end date")
        
        # Create participant
        participant = TripParticipant(
            trip_id=trip_id,
            **participant_data.model_dump()
        )
        
        self.session.add(participant)
        await self.session.commit()
        await self.session.refresh(participant)
        
        return Participant.model_validate(participant)
    
    async def update_participant(
        self,
        trip_id: UUID,
        participant_id: UUID,
        participant_data: ParticipantUpdate
    ) -> Participant:
        """
        Update a participant's information.
        
        Args:
            trip_id: The trip ID
            participant_id: The participant ID
            participant_data: Update data
            
        Returns:
            The updated participant
            
        Raises:
            NotFoundError: If trip or participant not found
            ValidationError: If update data invalid
        """
        # Get participant with trip
        stmt = select(TripParticipant).options(
            selectinload(TripParticipant.trip)
        ).where(
            and_(
                TripParticipant.id == participant_id,
                TripParticipant.trip_id == trip_id
            )
        )
        
        result = await self.session.execute(stmt)
        participant = result.scalar_one_or_none()
        
        if not participant:
            raise NotFoundError(f"Participant {participant_id} not found in trip {trip_id}")
        
        # Validate attendance dates if provided
        trip = participant.trip
        update_dict = participant_data.model_dump(exclude_unset=True)
        
        if 'arrival_date' in update_dict and update_dict['arrival_date']:
            if update_dict['arrival_date'] < trip.start_date:
                raise ValidationError("Arrival date cannot be before trip start date")
            if update_dict['arrival_date'] > trip.end_date:
                raise ValidationError("Arrival date cannot be after trip end date")
                
        if 'departure_date' in update_dict and update_dict['departure_date']:
            if update_dict['departure_date'] < trip.start_date:
                raise ValidationError("Departure date cannot be before trip start date")
            if update_dict['departure_date'] > trip.end_date:
                raise ValidationError("Departure date cannot be after trip end date")
        
        # Update participant
        for field, value in update_dict.items():
            setattr(participant, field, value)
        
        await self.session.commit()
        await self.session.refresh(participant)
        
        return Participant.model_validate(participant)
    
    async def remove_participant(
        self,
        trip_id: UUID,
        participant_id: UUID
    ) -> None:
        """
        Remove a participant from a trip.
        
        Args:
            trip_id: The trip ID
            participant_id: The participant ID
            
        Raises:
            NotFoundError: If participant not found
        """
        stmt = select(TripParticipant).where(
            and_(
                TripParticipant.id == participant_id,
                TripParticipant.trip_id == trip_id
            )
        )
        
        result = await self.session.execute(stmt)
        participant = result.scalar_one_or_none()
        
        if not participant:
            raise NotFoundError(f"Participant {participant_id} not found in trip {trip_id}")
        
        await self.session.delete(participant)
        await self.session.commit()
    
    async def get_participants_for_day(
        self,
        trip_id: UUID,
        day_number: int
    ) -> DayParticipants:
        """
        Get all participants present on a specific day of the trip.
        
        Args:
            trip_id: The trip ID
            day_number: The day number (1-based)
            
        Returns:
            DayParticipants with list of participants and totals
            
        Raises:
            NotFoundError: If trip or day not found
        """
        # Get trip with days
        stmt = select(Trip).options(
            selectinload(Trip.days)
        ).where(Trip.id == trip_id)
        
        result = await self.session.execute(stmt)
        trip = result.scalar_one_or_none()
        
        if not trip:
            raise NotFoundError(f"Trip {trip_id} not found")
        
        # Find the specific day
        trip_day = None
        for day in trip.days:
            if day.day_number == day_number:
                trip_day = day
                break
        
        if not trip_day:
            raise NotFoundError(f"Day {day_number} not found in trip {trip_id}")
        
        # Get all participants for the trip
        stmt = select(TripParticipant).where(
            TripParticipant.trip_id == trip_id
        )
        
        result = await self.session.execute(stmt)
        all_participants = result.scalars().all()
        
        # Filter participants present on this day
        present_participants = []
        total_coefficient = Decimal('0')
        
        for participant in all_participants:
            if participant.is_present_on_date(trip_day.date):
                present_participants.append(participant)
                total_coefficient += participant.coefficient
        
        return DayParticipants(
            day_number=day_number,
            date=trip_day.date,
            total_participants=len(present_participants),
            total_coefficient=total_coefficient,
            participants=[
                Participant.model_validate(p) for p in present_participants
            ]
        )
    
    async def calculate_meal_participants(
        self,
        trip_id: UUID,
        day_number: int,
        meal_type: str
    ) -> tuple[int, Decimal]:
        """
        Calculate total participants and effective coefficient for a specific meal.
        
        Args:
            trip_id: The trip ID
            day_number: The day number
            meal_type: Type of meal (breakfast, lunch, dinner, snack)
            
        Returns:
            Tuple of (participant_count, total_effective_coefficient)
            
        Raises:
            NotFoundError: If trip or day not found
        """
        # Get participants for the day
        day_participants = await self.get_participants_for_day(trip_id, day_number)
        
        # Calculate effective coefficients
        participant_count = 0
        total_coefficient = Decimal('0')
        
        for participant in day_participants.participants:
            effective_coef = participant.get_effective_coefficient(
                meal_type,
                day_participants.date
            )
            if effective_coef > 0:
                participant_count += 1
                total_coefficient += effective_coef
        
        return participant_count, total_coefficient
    
    async def get_participant(
        self,
        trip_id: UUID,
        participant_id: UUID
    ) -> Participant:
        """
        Get a specific participant.
        
        Args:
            trip_id: The trip ID
            participant_id: The participant ID
            
        Returns:
            The participant
            
        Raises:
            NotFoundError: If participant not found
        """
        stmt = select(TripParticipant).where(
            and_(
                TripParticipant.id == participant_id,
                TripParticipant.trip_id == trip_id
            )
        )
        
        result = await self.session.execute(stmt)
        participant = result.scalar_one_or_none()
        
        if not participant:
            raise NotFoundError(f"Participant {participant_id} not found in trip {trip_id}")
        
        return Participant.model_validate(participant)
    
    async def list_participants(
        self,
        trip_id: UUID
    ) -> List[Participant]:
        """
        List all participants for a trip.
        
        Args:
            trip_id: The trip ID
            
        Returns:
            List of participants
            
        Raises:
            NotFoundError: If trip not found
        """
        # Verify trip exists
        stmt = select(Trip).where(Trip.id == trip_id)
        result = await self.session.execute(stmt)
        trip = result.scalar_one_or_none()
        
        if not trip:
            raise NotFoundError(f"Trip {trip_id} not found")
        
        # Get participants
        stmt = select(TripParticipant).where(
            TripParticipant.trip_id == trip_id
        ).order_by(TripParticipant.created_at)
        
        result = await self.session.execute(stmt)
        participants = result.scalars().all()
        
        return [Participant.model_validate(p) for p in participants]