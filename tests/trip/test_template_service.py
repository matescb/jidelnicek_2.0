"""
Tests for trip template service functionality.

This module tests the template service operations including:
- Creating trips from templates
- Template CRUD operations
- Permission handling
"""

import pytest
from datetime import date, datetime, timezone, timedelta
from uuid import UUID, uuid4
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.trip.services.template_service import TripTemplateService
from jidelnicek.trip.schemas.template import (
    TripTemplateCreate, CreateTripFromTemplate, ParticipantTemplate
)
from jidelnicek.trip.models.template import TripTemplate
from jidelnicek.trip.models.trip import Trip
from jidelnicek.core.exceptions import NotFoundError, PermissionError


@pytest.mark.asyncio
class TestCreateTripFromTemplate:
    """Test creating trips from templates."""
    
    async def test_create_trip_from_public_template(
        self,
        db_session: AsyncSession,
        test_user,
        other_user
    ):
        """Test creating a trip from a public template."""
        service = TripTemplateService(db_session)
        
        # Create a public template as another user
        template_data = TripTemplateCreate(
            name="Public Camping Template",
            description="A template for camping trips",
            duration_days=5,
            meal_slots=["Breakfast", "Lunch", "Dinner"],
            participants=[
                ParticipantTemplate(name="Adult", coefficient=Decimal("100.00")),
                ParticipantTemplate(name="Child", coefficient=Decimal("50.00"))
            ],
            is_public=True,
            category="camping",
            tags=["outdoor", "family"]
        )
        
        template = await service.create_template(other_user.id, template_data)
        
        # Create trip from template as test user
        create_data = CreateTripFromTemplate(
            template_id=template.id,
            trip_name="My Camping Trip",
            start_date=date(2024, 7, 1),
            include_meal_assignments=True
        )
        
        trip = await service.create_trip_from_template(
            template_id=template.id,
            user_id=test_user.id,
            create_data=create_data
        )
        
        # Verify trip was created correctly
        assert trip.name == "My Camping Trip"
        assert trip.user_id == test_user.id
        assert trip.start_date == date(2024, 7, 1)
        assert trip.end_date == date(2024, 7, 5)  # 5 days duration
        assert trip.meal_slots == ["Breakfast", "Lunch", "Dinner"]
        
    async def test_create_trip_from_private_template_owned(
        self,
        db_session: AsyncSession,
        test_user
    ):
        """Test creating a trip from user's own private template."""
        service = TripTemplateService(db_session)
        
        # Create a private template
        template_data = TripTemplateCreate(
            name="Private Template",
            duration_days=3,
            meal_slots=["Breakfast", "Dinner"],
            is_public=False
        )
        
        template = await service.create_template(test_user.id, template_data)
        
        # Create trip from own template
        create_data = CreateTripFromTemplate(
            template_id=template.id,
            trip_name="My Trip",
            start_date=date(2024, 8, 1)
        )
        
        trip = await service.create_trip_from_template(
            template_id=template.id,
            user_id=test_user.id,
            create_data=create_data
        )
        
        assert trip.name == "My Trip"
        assert trip.end_date == date(2024, 8, 3)
        
    async def test_create_trip_from_private_template_denied(
        self,
        db_session: AsyncSession,
        test_user,
        other_user
    ):
        """Test that users cannot create trips from others' private templates."""
        service = TripTemplateService(db_session)
        
        # Create a private template as another user
        template_data = TripTemplateCreate(
            name="Private Template",
            duration_days=3,
            is_public=False
        )
        
        template = await service.create_template(other_user.id, template_data)
        
        # Try to create trip from template as different user
        create_data = CreateTripFromTemplate(
            template_id=template.id,
            trip_name="My Trip",
            start_date=date(2024, 8, 1)
        )
        
        with pytest.raises(PermissionError):
            await service.create_trip_from_template(
                template_id=template.id,
                user_id=test_user.id,
                create_data=create_data
            )
            
    async def test_create_trip_with_participant_overrides(
        self,
        db_session: AsyncSession,
        test_user
    ):
        """Test creating a trip with custom participants."""
        service = TripTemplateService(db_session)
        
        # Create template with default participants
        template_data = TripTemplateCreate(
            name="Template with Participants",
            duration_days=2,
            participants=[
                ParticipantTemplate(name="Person 1", coefficient=Decimal("100.00")),
                ParticipantTemplate(name="Person 2", coefficient=Decimal("100.00"))
            ]
        )
        
        template = await service.create_template(test_user.id, template_data)
        
        # Create trip with different participants
        create_data = CreateTripFromTemplate(
            template_id=template.id,
            trip_name="Custom Participants Trip",
            start_date=date(2024, 9, 1),
            participant_overrides=[
                ParticipantTemplate(name="Alice", coefficient=Decimal("100.00")),
                ParticipantTemplate(name="Bob", coefficient=Decimal("75.00")),
                ParticipantTemplate(name="Charlie", coefficient=Decimal("50.00"))
            ]
        )
        
        trip = await service.create_trip_from_template(
            template_id=template.id,
            user_id=test_user.id,
            create_data=create_data
        )
        
        # Verify custom participants were used
        # Note: Will need to fetch participants through separate service
        assert trip.name == "Custom Participants Trip"
        
    async def test_create_trip_with_meal_slot_overrides(
        self,
        db_session: AsyncSession,
        test_user
    ):
        """Test creating a trip with custom meal slots."""
        service = TripTemplateService(db_session)
        
        # Create template with default meal slots
        template_data = TripTemplateCreate(
            name="Template with Meals",
            duration_days=2,
            meal_slots=["Breakfast", "Lunch", "Dinner"]
        )
        
        template = await service.create_template(test_user.id, template_data)
        
        # Create trip with different meal slots
        create_data = CreateTripFromTemplate(
            template_id=template.id,
            trip_name="Custom Meals Trip",
            start_date=date(2024, 10, 1),
            meal_slot_overrides=["Brunch", "Dinner", "Snack"]
        )
        
        trip = await service.create_trip_from_template(
            template_id=template.id,
            user_id=test_user.id,
            create_data=create_data
        )
        
        # Verify custom meal slots were used
        assert trip.meal_slots == ["Brunch", "Dinner", "Snack"]
        
    async def test_create_trip_from_nonexistent_template(
        self,
        db_session: AsyncSession,
        test_user
    ):
        """Test creating a trip from a template that doesn't exist."""
        service = TripTemplateService(db_session)
        
        create_data = CreateTripFromTemplate(
            template_id=uuid4(),
            trip_name="My Trip",
            start_date=date(2024, 11, 1)
        )
        
        with pytest.raises(NotFoundError):
            await service.create_trip_from_template(
                template_id=create_data.template_id,
                user_id=test_user.id,
                create_data=create_data
            )
            
    async def test_create_trip_with_notes(
        self,
        db_session: AsyncSession,
        test_user
    ):
        """Test creating a trip with initial notes."""
        service = TripTemplateService(db_session)
        
        # Create a simple template
        template_data = TripTemplateCreate(
            name="Simple Template",
            duration_days=1
        )
        
        template = await service.create_template(test_user.id, template_data)
        
        # Create trip with notes
        create_data = CreateTripFromTemplate(
            template_id=template.id,
            trip_name="Trip with Notes",
            start_date=date(2024, 12, 1),
            notes="Remember to bring camping gear"
        )
        
        trip = await service.create_trip_from_template(
            template_id=template.id,
            user_id=test_user.id,
            create_data=create_data
        )
        
        assert trip.notes == "Remember to bring camping gear"