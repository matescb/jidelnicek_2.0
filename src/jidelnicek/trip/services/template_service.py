"""
Trip template service for managing reusable trip configurations.

This module provides business logic for trip template management including:
- CRUD operations for templates
- Public/private template management
- Creating trips from templates
- Template duplication and usage statistics
- Permission checks and authorization
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from jidelnicek.core.services.base import BaseService
from jidelnicek.trip.models.template import TripTemplate
from jidelnicek.trip.models.trip import Trip
from jidelnicek.trip.schemas.template import (
    TripTemplateCreate, TripTemplateUpdate, TripTemplate as TripTemplateResponse,
    TripTemplatePreview, TripTemplateList, CreateTripFromTemplate,
    TripTemplateSearchFilters
)
from jidelnicek.trip.schemas.trip import TripCreate
from jidelnicek.trip.services.trip_service import TripService
from jidelnicek.core.exceptions import (
    NotFoundError, PermissionError, ValidationError, ConflictError
)
from jidelnicek.auth.models import AuthUser


class TripTemplateService(BaseService):
    """Service class for trip template management operations."""
    
    @property
    def model(self):
        """Return the TripTemplate model class."""
        return TripTemplate
    
    def __init__(self, session: AsyncSession):
        """
        Initialize trip template service.
        
        Args:
            session: AsyncSession instance for database operations
        """
        super().__init__(session)
        self.trip_service = TripService(session)
    
    async def create_template(
        self, 
        user_id: UUID, 
        template_data: TripTemplateCreate
    ) -> TripTemplate:
        """
        Create a new trip template.
        
        Args:
            user_id: ID of the user creating the template
            template_data: Template creation data
            
        Returns:
            Created template instance
            
        Raises:
            ValidationError: If template data is invalid
        """
        async with self.session.begin():
            # Prepare template data
            template_dict = template_data.model_dump()
            
            # Convert meal assignments to storage format
            meal_assignments = {}
            if template_dict.get('meal_assignments'):
                assignments = template_dict.pop('meal_assignments')
                for assignment in assignments:
                    day_key = str(assignment['day_number'])
                    if day_key not in meal_assignments:
                        meal_assignments[day_key] = {}
                    meal_assignments[day_key][assignment['meal_slot']] = {
                        'recipe_id': str(assignment['recipe_id']) if assignment.get('recipe_id') else None,
                        'meal_type': assignment.get('meal_type'),
                        'notes': assignment.get('notes')
                    }
            
            # Convert participants to storage format
            participants = []
            if template_dict.get('participants'):
                for participant in template_dict['participants']:
                    participants.append({
                        'name': participant['name'],
                        'coefficient': float(participant['coefficient']) / 100.0  # Convert percentage to decimal
                    })
            
            # Create template instance
            template = TripTemplate(
                user_id=user_id,
                name=template_dict['name'],
                description=template_dict.get('description'),
                duration_days=template_dict['duration_days'],
                meal_slots=template_dict['meal_slots'],
                participants=participants,
                meal_assignments=meal_assignments,
                is_public=template_dict.get('is_public', False),
                category=template_dict.get('category'),
                tags=template_dict.get('tags', [])
            )
            
            self.session.add(template)
            await self.session.commit()
            
            # Reload with relationships
            await self.session.refresh(template)
            
            return template
    
    async def get_template(
        self,
        template_id: UUID,
        user_id: Optional[UUID] = None
    ) -> TripTemplate:
        """
        Get template details.
        
        Args:
            template_id: ID of the template
            user_id: ID of the requesting user (for permission check)
            
        Returns:
            Template instance
            
        Raises:
            NotFoundError: If template not found
            PermissionError: If user doesn't have access to private template
        """
        # Build query with eager loading
        query = select(TripTemplate).where(TripTemplate.id == template_id)
        query = query.options(selectinload(TripTemplate.user))
        
        result = await self.session.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            raise NotFoundError(f"Template {template_id} not found")
        
        # Check permissions for private templates
        if not template.is_public and user_id and template.user_id != user_id:
            raise PermissionError("You don't have permission to view this template")
        
        return template
    
    async def list_templates(
        self,
        user_id: UUID,
        filters: Optional[TripTemplateSearchFilters] = None,
        skip: int = 0,
        limit: int = 20
    ) -> TripTemplateList:
        """
        List templates with filtering and pagination.
        
        Shows user's own templates and public templates from other users.
        
        Args:
            user_id: ID of the requesting user
            filters: Optional search filters
            skip: Number of items to skip
            limit: Maximum number of items to return
            
        Returns:
            Paginated template list response
        """
        # Base query - user's templates OR public templates
        query = select(TripTemplate).where(
            or_(
                TripTemplate.user_id == user_id,
                TripTemplate.is_public == True
            )
        )
        
        # Apply filters
        if filters:
            if filters.query:
                query = query.where(
                    or_(
                        TripTemplate.name.ilike(f"%{filters.query}%"),
                        TripTemplate.description.ilike(f"%{filters.query}%")
                    )
                )
            
            if filters.is_public is not None:
                query = query.where(TripTemplate.is_public == filters.is_public)
            
            if filters.category:
                query = query.where(TripTemplate.category == filters.category)
            
            if filters.tags:
                # Filter by any of the provided tags
                tag_conditions = []
                for tag in filters.tags:
                    tag_conditions.append(
                        func.jsonb_array_elements_text(TripTemplate.tags).op('=')(tag.lower())
                    )
                if tag_conditions:
                    query = query.where(or_(*tag_conditions))
            
            if filters.min_duration_days:
                query = query.where(TripTemplate.duration_days >= filters.min_duration_days)
            
            if filters.max_duration_days:
                query = query.where(TripTemplate.duration_days <= filters.max_duration_days)
            
            if filters.min_participants:
                query = query.where(
                    func.jsonb_array_length(TripTemplate.participants) >= filters.min_participants
                )
            
            if filters.max_participants:
                query = query.where(
                    func.jsonb_array_length(TripTemplate.participants) <= filters.max_participants
                )
            
            if filters.created_by_me:
                query = query.where(TripTemplate.user_id == user_id)
            
            if filters.created_after:
                query = query.where(TripTemplate.created_at >= filters.created_after)
            
            if filters.created_before:
                query = query.where(TripTemplate.created_at <= filters.created_before)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total_count = total_result.scalar() or 0
        
        # Apply pagination and ordering
        query = query.order_by(TripTemplate.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        # Include user relationship for public templates
        query = query.options(selectinload(TripTemplate.user))
        
        # Execute query
        result = await self.session.execute(query)
        templates = result.scalars().all()
        
        # Get usage counts for templates
        template_ids = [t.id for t in templates]
        usage_counts = await self._get_template_usage_counts(template_ids)
        
        # Convert to response items
        items = []
        for template in templates:
            items.append(TripTemplatePreview(
                id=template.id,
                name=template.name,
                description=template.description,
                duration_days=template.duration_days,
                participant_count=len(template.participants),
                meal_slot_count=len(template.meal_slots),
                is_public=template.is_public,
                category=template.category,
                tags=template.tags,
                created_by_name=template.user.username if template.is_public and template.user else None,
                usage_count=usage_counts.get(template.id, 0),
                created_at=template.created_at,
                updated_at=template.updated_at
            ))
        
        # Calculate pagination metadata
        page_size = limit
        total_pages = (total_count + page_size - 1) // page_size
        current_page = (skip // page_size) + 1
        
        return TripTemplateList(
            items=items,
            total=total_count,
            page=current_page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=current_page < total_pages,
            has_prev=current_page > 1
        )
    
    async def update_template(
        self,
        template_id: UUID,
        user_id: UUID,
        update_data: TripTemplateUpdate
    ) -> TripTemplate:
        """
        Update template information.
        
        Args:
            template_id: ID of the template to update
            user_id: ID of the requesting user
            update_data: Update data
            
        Returns:
            Updated template instance
            
        Raises:
            NotFoundError: If template not found
            PermissionError: If user doesn't own the template
            ValidationError: If update data is invalid
        """
        # Get template and verify ownership
        template = await self.get_template(template_id, user_id)
        
        if template.user_id != user_id:
            raise PermissionError("You can only update your own templates")
        
        # Prepare update data
        update_dict = update_data.model_dump(exclude_unset=True, exclude_none=True)
        
        # Convert meal assignments if provided
        if 'meal_assignments' in update_dict:
            meal_assignments = {}
            assignments = update_dict.pop('meal_assignments')
            if assignments:
                for assignment in assignments:
                    day_key = str(assignment['day_number'])
                    if day_key not in meal_assignments:
                        meal_assignments[day_key] = {}
                    meal_assignments[day_key][assignment['meal_slot']] = {
                        'recipe_id': str(assignment['recipe_id']) if assignment.get('recipe_id') else None,
                        'meal_type': assignment.get('meal_type'),
                        'notes': assignment.get('notes')
                    }
            update_dict['meal_assignments'] = meal_assignments
        
        # Convert participants if provided
        if 'participants' in update_dict:
            participants = []
            for participant in update_dict['participants']:
                participants.append({
                    'name': participant['name'],
                    'coefficient': float(participant['coefficient']) / 100.0  # Convert percentage to decimal
                })
            update_dict['participants'] = participants
        
        # Validate duration vs meal assignments
        if 'duration_days' in update_dict or 'meal_assignments' in update_dict:
            duration = update_dict.get('duration_days', template.duration_days)
            assignments = update_dict.get('meal_assignments', template.meal_assignments)
            
            if assignments:
                for day_key in assignments.keys():
                    if int(day_key) > duration:
                        raise ValidationError(
                            f"Meal assignment day {day_key} exceeds template duration {duration}"
                        )
        
        # Update template fields
        for field, value in update_dict.items():
            setattr(template, field, value)
        
        template.updated_at = datetime.now(timezone.utc)
        
        await self.session.commit()
        await self.session.refresh(template)
        
        return template
    
    async def delete_template(
        self,
        template_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Delete a template.
        
        Args:
            template_id: ID of the template to delete
            user_id: ID of the requesting user
            
        Returns:
            True if deleted successfully
            
        Raises:
            NotFoundError: If template not found
            PermissionError: If user doesn't own the template
        """
        # Get template and verify ownership
        template = await self.get_template(template_id, user_id)
        
        if template.user_id != user_id:
            raise PermissionError("You can only delete your own templates")
        
        await self.session.delete(template)
        await self.session.commit()
        
        return True
    
    async def create_trip_from_template(
        self,
        template_id: UUID,
        user_id: UUID,
        create_data: CreateTripFromTemplate
    ) -> Trip:
        """
        Create a new trip from a template.
        
        Args:
            template_id: ID of the template to use
            user_id: ID of the user creating the trip
            create_data: Trip creation options
            
        Returns:
            Created trip instance
            
        Raises:
            NotFoundError: If template not found
            PermissionError: If user doesn't have access to template
            ValidationError: If creation data is invalid
        """
        # Get template (will check permissions)
        template = await self.get_template(create_data.template_id, user_id)
        
        # Calculate end date based on template duration
        end_date = create_data.start_date + timedelta(days=template.duration_days - 1)
        
        # Prepare participants
        if create_data.participant_overrides:
            # Use provided participants
            participants = [
                {
                    'name': p.name,
                    'number': idx + 1,
                    'coefficient': float(p.coefficient)
                }
                for idx, p in enumerate(create_data.participant_overrides)
            ]
        else:
            # Use template participants
            participants = [
                {
                    'name': p['name'],
                    'number': idx + 1,
                    'coefficient': p['coefficient'] * 100.0  # Convert back to percentage
                }
                for idx, p in enumerate(template.participants)
            ]
        
        # Prepare meal slots
        meal_slots = create_data.meal_slot_overrides or template.meal_slots
        
        # Create trip data
        trip_create = TripCreate(
            name=create_data.trip_name,
            start_date=create_data.start_date,
            end_date=end_date,
            meal_slots=meal_slots,
            participants=participants
        )
        
        # Create the trip
        trip = await self.trip_service.create_trip(user_id, trip_create)
        
        # TODO: Apply meal assignments if requested and when meal models are available
        # if create_data.include_meal_assignments and template.meal_assignments:
        #     await self._apply_meal_assignments(trip, template.meal_assignments)
        
        # Track template usage
        await self._increment_template_usage(template_id)
        
        return trip
    
    async def duplicate_template(
        self,
        template_id: UUID,
        user_id: UUID,
        new_name: str
    ) -> TripTemplate:
        """
        Create a copy of an existing template.
        
        Args:
            template_id: ID of the template to duplicate
            user_id: ID of the user creating the copy
            new_name: Name for the new template
            
        Returns:
            New template instance
            
        Raises:
            NotFoundError: If template not found
            PermissionError: If user doesn't have access to template
        """
        # Get source template
        source_template = await self.get_template(template_id, user_id)
        
        # Create new template data
        template_data = TripTemplateCreate(
            name=new_name,
            description=f"Copy of: {source_template.description}" if source_template.description else None,
            duration_days=source_template.duration_days,
            meal_slots=source_template.meal_slots.copy(),
            participants=[
                {
                    'name': p['name'],
                    'coefficient': p['coefficient'] * 100.0  # Convert to percentage
                }
                for p in source_template.participants
            ],
            meal_assignments=[],  # Will convert from storage format
            is_public=False,  # Copies are always private initially
            category=source_template.category,
            tags=source_template.tags.copy() if source_template.tags else []
        )
        
        # Convert meal assignments back to creation format
        if source_template.meal_assignments:
            meal_assignments = []
            for day_str, day_meals in source_template.meal_assignments.items():
                for slot, meal_data in day_meals.items():
                    assignment = {
                        'day_number': int(day_str),
                        'meal_slot': slot,
                        'recipe_id': UUID(meal_data['recipe_id']) if meal_data.get('recipe_id') else None,
                        'meal_type': meal_data.get('meal_type'),
                        'notes': meal_data.get('notes')
                    }
                    meal_assignments.append(assignment)
            template_data.meal_assignments = meal_assignments
        
        # Create the new template
        return await self.create_template(user_id, template_data)
    
    async def get_public_templates(
        self,
        filters: Optional[TripTemplateSearchFilters] = None,
        skip: int = 0,
        limit: int = 20
    ) -> TripTemplateList:
        """
        Browse public templates from all users.
        
        Args:
            filters: Optional search filters
            skip: Number of items to skip
            limit: Maximum number of items to return
            
        Returns:
            Paginated template list response
        """
        # Force public filter
        if filters:
            filters.is_public = True
        else:
            filters = TripTemplateSearchFilters(is_public=True)
        
        # Use a dummy user_id since we're only showing public templates
        dummy_user_id = UUID('00000000-0000-0000-0000-000000000000')
        
        return await self.list_templates(dummy_user_id, filters, skip, limit)
    
    async def get_template_usage_stats(
        self,
        template_id: UUID
    ) -> Dict[str, Any]:
        """
        Get usage statistics for a template.
        
        Args:
            template_id: ID of the template
            
        Returns:
            Dictionary with usage statistics
        """
        # Get template to ensure it exists
        template = await self.get_template(template_id)
        
        # Get usage count from metadata or count trips
        # For now, we'll use a placeholder since trip metadata isn't implemented
        usage_count = await self._get_template_usage_count(template_id)
        
        # Get category statistics
        category_count = 0
        if template.category:
            count_result = await self.session.execute(
                select(func.count(TripTemplate.id)).where(
                    and_(
                        TripTemplate.category == template.category,
                        TripTemplate.is_public == True
                    )
                )
            )
            category_count = count_result.scalar() or 0
        
        # Get creator info
        user_query = select(AuthUser).where(AuthUser.id == template.user_id)
        user_result = await self.session.execute(user_query)
        user = user_result.scalar_one_or_none()
        
        return {
            "template_id": template_id,
            "usage_count": usage_count,
            "is_public": template.is_public,
            "category": template.category,
            "category_template_count": category_count,
            "created_by": user.username if user else "Unknown",
            "created_at": template.created_at,
            "last_used_at": None,  # TODO: Track last usage when trip metadata is available
            "average_rating": None,  # TODO: Implement ratings
            "total_ratings": 0
        }
    
    async def _get_template_usage_count(self, template_id: UUID) -> int:
        """Get usage count for a single template."""
        # TODO: Implement proper tracking when trip metadata is available
        # For now, return a placeholder
        return 0
    
    async def _get_template_usage_counts(self, template_ids: List[UUID]) -> Dict[UUID, int]:
        """Get usage counts for multiple templates."""
        # TODO: Implement proper tracking when trip metadata is available
        # For now, return empty counts
        return {template_id: 0 for template_id in template_ids}
    
    async def _increment_template_usage(self, template_id: UUID) -> None:
        """Increment usage count for a template."""
        # TODO: Implement proper tracking when trip metadata is available
        pass
    
    async def _apply_meal_assignments(self, trip: Trip, meal_assignments: Dict[str, Any]) -> None:
        """Apply meal assignments from template to trip."""
        # TODO: Implement when meal models are available
        pass