"""
Examples of using optimized SQLAlchemy query patterns.

This module demonstrates how to use the optimized services and query helpers
for better database performance.
"""

from uuid import UUID
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from jidelnicek.core.query_helpers import (
    query_profiling_context, QueryOptimizer, PaginationHelper,
    RelationshipLoader, profile_query
)
from jidelnicek.core.services.base import BaseService
from jidelnicek.recipe.services.optimized_recipe_service import OptimizedRecipeService
from jidelnicek.recipe.models import Recipe
from jidelnicek.auth.models import AuthUser


class ExampleUsage:
    """Examples of optimized database operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.recipe_service = OptimizedRecipeService(session)
        self.query_optimizer = QueryOptimizer()
        self.pagination_helper = PaginationHelper()
    
    async def example_eager_loading(self, user_id: UUID):
        """Example of using eager loading to avoid N+1 queries."""
        
        # BAD: This will cause N+1 queries
        # users = await self.session.execute(select(AuthUser))
        # for user in users.scalars():
        #     print(f"User {user.email} has {len(user.sessions)} sessions")
        
        # GOOD: Use eager loading to load all data in one query
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        
        stmt = (
            select(AuthUser)
            .options(selectinload(AuthUser.sessions))
            .where(AuthUser.id == user_id)
        )
        
        result = await self.session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if user:
            print(f"User {user.email} has {len(user.sessions)} sessions")
    
    async def example_optimized_pagination(self, user_id: UUID):
        """Example of optimized pagination."""
        
        # Use the optimized recipe service
        paginated_recipes = await self.recipe_service.get_user_recipes_optimized(
            user_id=user_id,
            page=1,
            page_size=10,
            include_ingredients=True
        )
        
        print(f"Found {paginated_recipes['total']} recipes")
        print(f"Page {paginated_recipes['page']} of {paginated_recipes['total_pages']}")
        
        for recipe in paginated_recipes['items']:
            print(f"Recipe: {recipe.name} with {len(recipe.ingredients)} ingredients")
    
    async def example_batch_operations(self, recipe_ids: List[UUID]):
        """Example of batch operations to reduce database round trips."""
        
        # Get multiple recipes with ingredients in a single query
        recipes = await self.recipe_service.get_recipes_with_ingredients_batch(recipe_ids)
        
        # Calculate nutrition for all recipes in batch
        nutrition_data = await self.recipe_service.get_nutrition_for_recipes_batch(recipe_ids)
        
        for recipe in recipes:
            nutrition = nutrition_data.get(recipe.id, {})
            print(f"Recipe {recipe.name}: {nutrition.get('per_serving', {}).get('calories', 'N/A')} calories per serving")
    
    async def example_search_optimization(self, search_term: str):
        """Example of optimized search operations."""
        
        # Use the optimized search method
        search_results = await self.recipe_service.search(
            query=search_term,
            page=1,
            page_size=20,
            relationships=['ingredients', 'images']
        )
        
        print(f"Found {search_results['total']} recipes matching '{search_term}'")
        
        for recipe in search_results['items']:
            print(f"Recipe: {recipe.name}")
            print(f"  Ingredients: {len(recipe.ingredients)}")
            print(f"  Images: {len(recipe.images)}")
    
    async def example_query_profiling(self, user_id: UUID):
        """Example of query profiling for performance monitoring."""
        
        # Use query profiling context to monitor performance
        with query_profiling_context() as profiler:
            # Perform database operations
            recipes = await self.recipe_service.get_user_recipes_optimized(
                user_id=user_id,
                page=1,
                page_size=10
            )
            
            # Get recipe details
            if recipes['items']:
                recipe = await self.recipe_service.get_recipe_with_full_details(
                    recipes['items'][0].id,
                    user_id
                )
        
        # Review performance statistics
        stats = profiler.get_stats()
        print(f"Executed {stats['query_count']} queries in {stats['total_time']:.3f}s")
        
        # Check for slow queries
        if stats['query_count'] > 10:
            print("Warning: High query count detected!")
    
    async def example_caching(self, recipe_id: UUID):
        """Example of using caching for frequently accessed data."""
        
        # First call - loads from database
        recipe = await self.recipe_service.get_cached(
            recipe_id,
            relationships=['ingredients', 'images']
        )
        
        # Second call - loads from cache
        recipe_cached = await self.recipe_service.get_cached(
            recipe_id,
            relationships=['ingredients', 'images']
        )
        
        print(f"Recipe: {recipe.name}")
        print("Second call should be faster due to caching")
    
    async def example_bulk_operations(self, user_id: UUID):
        """Example of bulk operations for better performance."""
        
        # Create multiple recipes in a single transaction
        recipe_data_list = [
            {
                'name': f'Recipe {i}',
                'description': f'Description for recipe {i}',
                'user_id': user_id,
                'servings': 4
            }
            for i in range(1, 6)
        ]
        
        # Use bulk create for better performance
        recipes = await self.recipe_service.bulk_create(recipe_data_list)
        print(f"Created {len(recipes)} recipes in bulk")
        
        # Bulk update example
        updates = [
            {'id': recipe.id, 'description': f'Updated description for {recipe.name}'}
            for recipe in recipes
        ]
        
        updated_count = await self.recipe_service.bulk_update(updates)
        print(f"Updated {updated_count} recipes in bulk")
    
    async def example_relationship_optimization(self, recipe_id: UUID):
        """Example of optimizing relationship loading."""
        
        # Use the relationship loader for complex queries
        query = RelationshipLoader.create_recipe_with_full_details_query(self.session)
        
        # Add additional filters
        query = query.filter(Recipe.id == recipe_id)
        
        result = await self.session.execute(query)
        recipe = result.scalar_one_or_none()
        
        if recipe:
            print(f"Recipe: {recipe.name}")
            print(f"  Ingredients: {len(recipe.ingredients)}")
            print(f"  Images: {len(recipe.images)}")
            print(f"  Versions: {len(recipe.versions)}")
            print(f"  Categories: {len(recipe.recipe_categories)}")
    
    async def example_performance_monitoring(self):
        """Example of monitoring database performance."""
        
        # Get current query statistics
        stats = self.recipe_service.get_query_stats()
        print(f"Current query stats: {stats}")
        
        # Perform some operations
        await self.recipe_service.get_popular_recipes(limit=5)
        
        # Get updated statistics
        updated_stats = self.recipe_service.get_query_stats()
        print(f"Updated query stats: {updated_stats}")
        
        # Reset statistics
        self.recipe_service.reset_query_stats()
        print("Query statistics reset")


# Example usage in a route or service
async def example_route_handler(session: AsyncSession, user_id: UUID):
    """Example of using optimized patterns in a route handler."""
    
    example = ExampleUsage(session)
    
    # Use query profiling to monitor performance
    with query_profiling_context() as profiler:
        # Get user's recipes with pagination
        recipes = await example.recipe_service.get_user_recipes_optimized(
            user_id=user_id,
            page=1,
            page_size=10,
            include_ingredients=True
        )
        
        # If recipes exist, get detailed information for the first one
        if recipes['items']:
            first_recipe = recipes['items'][0]
            
            # Get full recipe details
            detailed_recipe = await example.recipe_service.get_recipe_with_full_details(
                first_recipe.id,
                user_id
            )
            
            # Get recipe statistics
            stats = await example.recipe_service.get_recipe_statistics(first_recipe.id)
    
    # Log performance metrics
    performance_stats = profiler.get_stats()
    print(f"Route executed {performance_stats['query_count']} queries in {performance_stats['total_time']:.3f}s")
    
    return {
        'recipes': recipes,
        'performance': performance_stats
    }


# Example of service composition
class OptimizedUserService(BaseService):
    """Example of an optimized user service."""
    
    @property
    def model(self):
        return AuthUser
    
    @profile_query
    async def get_user_with_recipes(self, user_id: UUID, include_ingredients: bool = False):
        """Get user with their recipes using optimized loading."""
        
        # Use eager loading for user and recipes
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        
        query = select(AuthUser).options(
            selectinload(AuthUser.sessions),
            selectinload(AuthUser.api_tokens)
        ).where(AuthUser.id == user_id)
        
        result = await self.session.execute(query)
        user = result.scalar_one_or_none()
        
        if user:
            # Get user's recipes separately with optimized query
            recipe_service = OptimizedRecipeService(self.session)
            recipes = await recipe_service.get_user_recipes_optimized(
                user_id=user_id,
                page=1,
                page_size=20,
                include_ingredients=include_ingredients
            )
            
            # Add recipes to user object (not persisted)
            user.recipes = recipes['items']
            user.recipe_count = recipes['total']
        
        return user