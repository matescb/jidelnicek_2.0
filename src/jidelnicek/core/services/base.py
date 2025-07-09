"""
Base service classes with optimized query patterns.

This module provides base service classes that implement common patterns
for database operations with optimal query performance.
"""

from typing import Any, Dict, List, Optional, Type, TypeVar, Union
from uuid import UUID
from abc import ABC, abstractmethod

from sqlalchemy import Select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase, selectinload, joinedload
from sqlalchemy.exc import NoResultFound

from jidelnicek.core.query_helpers import (
    QueryOptimizer, PaginationHelper, query_profiler, 
    profile_query, QueryBuilder, RelationshipLoader
)

# Type variables
ModelType = TypeVar('ModelType', bound=DeclarativeBase)
CreateSchemaType = TypeVar('CreateSchemaType')
UpdateSchemaType = TypeVar('UpdateSchemaType')


class BaseService(ABC):
    """Base service class with common database operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.query_optimizer = QueryOptimizer()
        self.pagination_helper = PaginationHelper()
        self.query_builder = QueryBuilder()
    
    @property
    @abstractmethod
    def model(self) -> Type[ModelType]:
        """Return the model class this service operates on."""
        pass
    
    @profile_query
    async def get_by_id(
        self,
        id: UUID,
        relationships: Optional[List[str]] = None,
        raise_not_found: bool = True
    ) -> Optional[ModelType]:
        """
        Get a model instance by ID with optional relationship loading.
        
        Args:
            id: The ID to search for
            relationships: List of relationships to eagerly load
            raise_not_found: Whether to raise exception if not found
            
        Returns:
            Model instance or None
            
        Raises:
            NoResultFound: If raise_not_found is True and model not found
        """
        query = self.session.query(self.model).filter(self.model.id == id)
        
        # Add eager loading for relationships
        if relationships:
            for relationship in relationships:
                rel_attr = getattr(self.model, relationship)
                if hasattr(rel_attr.property, 'collection_class'):
                    query = query.options(selectinload(rel_attr))
                else:
                    query = query.options(joinedload(rel_attr))
        
        result = await self.session.execute(query)
        instance = result.scalar_one_or_none()
        
        if instance is None and raise_not_found:
            raise NoResultFound(f"{self.model.__name__} with id {id} not found")
        
        return instance
    
    @profile_query
    async def get_all(
        self,
        filters: Optional[Dict[str, Any]] = None,
        relationships: Optional[List[str]] = None,
        order_by: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[ModelType]:
        """
        Get all instances with optional filtering and eager loading.
        
        Args:
            filters: Dictionary of field: value filters
            relationships: List of relationships to eagerly load
            order_by: Field name to order by
            limit: Maximum number of results
            
        Returns:
            List of model instances
        """
        query = self.session.query(self.model)
        
        # Apply filters
        if filters:
            query = self.query_builder.create_filter_query(query, filters)
        
        # Add eager loading
        if relationships:
            for relationship in relationships:
                rel_attr = getattr(self.model, relationship)
                if hasattr(rel_attr.property, 'collection_class'):
                    query = query.options(selectinload(rel_attr))
                else:
                    query = query.options(joinedload(rel_attr))
        
        # Apply ordering
        if order_by:
            if order_by.startswith('-'):
                query = query.order_by(getattr(self.model, order_by[1:]).desc())
            else:
                query = query.order_by(getattr(self.model, order_by))
        
        # Apply limit
        if limit:
            query = query.limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    @profile_query
    async def get_paginated(
        self,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        relationships: Optional[List[str]] = None,
        order_by: Optional[str] = None,
        search_term: Optional[str] = None,
        search_fields: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get paginated results with optional filtering and search.
        
        Args:
            page: Page number (1-based)
            page_size: Number of items per page
            filters: Dictionary of field: value filters
            relationships: List of relationships to eagerly load
            order_by: Field name to order by
            search_term: Search term for text search
            search_fields: Fields to search in
            
        Returns:
            Dictionary with pagination data and metadata
        """
        query = self.session.query(self.model)
        
        # Apply search
        if search_term and search_fields:
            query = self.query_builder.create_search_query(
                self.model, search_fields, search_term, self.session
            )
        
        # Apply filters
        if filters:
            query = self.query_builder.create_filter_query(query, filters)
        
        # Add eager loading
        if relationships:
            for relationship in relationships:
                rel_attr = getattr(self.model, relationship)
                if hasattr(rel_attr.property, 'collection_class'):
                    query = query.options(selectinload(rel_attr))
                else:
                    query = query.options(joinedload(rel_attr))
        
        # Apply ordering
        if order_by:
            if order_by.startswith('-'):
                query = query.order_by(getattr(self.model, order_by[1:]).desc())
            else:
                query = query.order_by(getattr(self.model, order_by))
        
        return await self.pagination_helper.paginate(
            self.session, query, page, page_size
        )
    
    @profile_query
    async def create(
        self,
        data: Union[CreateSchemaType, Dict[str, Any]],
        relationships: Optional[List[str]] = None
    ) -> ModelType:
        """
        Create a new model instance.
        
        Args:
            data: Creation data (schema or dict)
            relationships: List of relationships to load after creation
            
        Returns:
            Created model instance
        """
        # Convert schema to dict if needed
        if hasattr(data, 'model_dump'):
            data_dict = data.model_dump(exclude_unset=True)
        else:
            data_dict = data
        
        # Create instance
        instance = self.model(**data_dict)
        self.session.add(instance)
        await self.session.flush()
        
        # Load relationships if requested
        if relationships:
            await self.session.refresh(instance)
            for relationship in relationships:
                # Trigger relationship loading
                getattr(instance, relationship)
        
        return instance
    
    @profile_query
    async def update(
        self,
        id: UUID,
        data: Union[UpdateSchemaType, Dict[str, Any]],
        relationships: Optional[List[str]] = None
    ) -> ModelType:
        """
        Update a model instance.
        
        Args:
            id: ID of the instance to update
            data: Update data (schema or dict)
            relationships: List of relationships to load after update
            
        Returns:
            Updated model instance
            
        Raises:
            NoResultFound: If instance not found
        """
        # Get instance
        instance = await self.get_by_id(id, raise_not_found=True)
        
        # Convert schema to dict if needed
        if hasattr(data, 'model_dump'):
            data_dict = data.model_dump(exclude_unset=True, exclude_none=True)
        else:
            data_dict = data
        
        # Update fields
        for field, value in data_dict.items():
            setattr(instance, field, value)
        
        await self.session.flush()
        
        # Load relationships if requested
        if relationships:
            await self.session.refresh(instance)
            for relationship in relationships:
                # Trigger relationship loading
                getattr(instance, relationship)
        
        return instance
    
    @profile_query
    async def delete(self, id: UUID) -> bool:
        """
        Delete a model instance.
        
        Args:
            id: ID of the instance to delete
            
        Returns:
            True if deleted, False if not found
        """
        instance = await self.get_by_id(id, raise_not_found=False)
        if instance:
            await self.session.delete(instance)
            return True
        return False
    
    @profile_query
    async def soft_delete(self, id: UUID) -> Optional[ModelType]:
        """
        Soft delete a model instance (if supported).
        
        Args:
            id: ID of the instance to soft delete
            
        Returns:
            Updated instance or None if not found
        """
        instance = await self.get_by_id(id, raise_not_found=False)
        if instance and hasattr(instance, 'is_archived'):
            instance.is_archived = True
            await self.session.flush()
            return instance
        return None
    
    @profile_query
    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Count instances with optional filtering.
        
        Args:
            filters: Dictionary of field: value filters
            
        Returns:
            Count of instances
        """
        query = self.session.query(func.count(self.model.id))
        
        # Apply filters
        if filters:
            for field, value in filters.items():
                if value is not None:
                    query = query.filter(getattr(self.model, field) == value)
        
        result = await self.session.execute(query)
        return result.scalar()
    
    @profile_query
    async def exists(self, id: UUID) -> bool:
        """
        Check if an instance exists.
        
        Args:
            id: ID to check
            
        Returns:
            True if exists, False otherwise
        """
        query = self.session.query(self.model.id).filter(self.model.id == id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none() is not None
    
    @profile_query
    async def bulk_create(self, data_list: List[Union[CreateSchemaType, Dict[str, Any]]]) -> List[ModelType]:
        """
        Create multiple instances in bulk.
        
        Args:
            data_list: List of creation data
            
        Returns:
            List of created instances
        """
        instances = []
        
        for data in data_list:
            # Convert schema to dict if needed
            if hasattr(data, 'model_dump'):
                data_dict = data.model_dump(exclude_unset=True)
            else:
                data_dict = data
            
            instance = self.model(**data_dict)
            instances.append(instance)
        
        self.session.add_all(instances)
        await self.session.flush()
        
        return instances
    
    @profile_query
    async def bulk_update(self, updates: List[Dict[str, Any]]) -> int:
        """
        Update multiple instances in bulk.
        
        Args:
            updates: List of update dictionaries with 'id' and update fields
            
        Returns:
            Number of updated instances
        """
        updated_count = 0
        
        for update_data in updates:
            id = update_data.pop('id')
            if update_data:  # Only update if there are fields to update
                query = self.session.query(self.model).filter(self.model.id == id)
                result = await self.session.execute(query.update(update_data))
                updated_count += result.rowcount
        
        return updated_count


class SearchableService(BaseService):
    """Service with advanced search capabilities."""
    
    @property
    @abstractmethod
    def search_fields(self) -> List[str]:
        """Return the fields that can be searched."""
        pass
    
    @profile_query
    async def search(
        self,
        query: str,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        relationships: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Search instances with full-text search capabilities.
        
        Args:
            query: Search query string
            page: Page number (1-based)
            page_size: Number of items per page
            filters: Additional filters
            relationships: List of relationships to eagerly load
            
        Returns:
            Dictionary with search results and metadata
        """
        return await self.get_paginated(
            page=page,
            page_size=page_size,
            filters=filters,
            relationships=relationships,
            search_term=query,
            search_fields=self.search_fields
        )


class CacheableService(BaseService):
    """Service with caching capabilities."""
    
    def __init__(self, session: AsyncSession):
        super().__init__(session)
        self.cache_ttl = 300  # 5 minutes default
    
    @profile_query
    async def get_cached(self, id: UUID, relationships: Optional[List[str]] = None) -> Optional[ModelType]:
        """
        Get instance with caching support.
        
        Args:
            id: ID to search for
            relationships: List of relationships to eagerly load
            
        Returns:
            Model instance or None
        """
        from jidelnicek.core.query_helpers import query_cache
        
        cache_key = f"{self.model.__name__}:{id}:{':'.join(relationships or [])}"
        
        # Check cache
        cached_result = query_cache.get(cache_key)
        if cached_result is not None:
            return cached_result
        
        # Get from database
        result = await self.get_by_id(id, relationships, raise_not_found=False)
        
        # Cache result
        if result:
            query_cache.set(cache_key, result)
        
        return result
    
    def invalidate_cache(self, id: UUID):
        """Invalidate cache for a specific instance."""
        from jidelnicek.core.query_helpers import query_cache
        
        # Clear all cache entries for this model and ID
        keys_to_remove = [
            key for key in query_cache.cache.keys()
            if key.startswith(f"{self.model.__name__}:{id}:")
        ]
        
        for key in keys_to_remove:
            if key in query_cache.cache:
                del query_cache.cache[key]
                if key in query_cache.access_order:
                    query_cache.access_order.remove(key)