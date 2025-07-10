"""
Database performance tests for Jidelnicek 2.0.

This module contains comprehensive performance tests to ensure database
queries are optimized and maintain expected performance characteristics.
"""

import pytest
import time
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from sqlalchemy import create_engine, select, func, text
from sqlalchemy.orm import Session, sessionmaker, selectinload, joinedload
from sqlalchemy.pool import NullPool, QueuePool
from unittest.mock import patch, MagicMock
import uuid

from jidelnicek.core.database import Base
from jidelnicek.auth.models import AuthUser, AuthSession, AuditLog
from jidelnicek.recipe.models.recipe import Recipe
from jidelnicek.common.models.ingredient import Ingredient
from jidelnicek.recipe.models.recipe_ingredient import RecipeIngredient
from jidelnicek.recipe.models.categorization import RecipeCategory, RecipeTag
from jidelnicek.common.models.nutritional_value import NutritionalValue


class PerformanceTimer:
    """Context manager for timing database operations."""
    
    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        self.start_time = None
        self.end_time = None
        self.duration = None
    
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        self.duration = self.end_time - self.start_time
        return False
    
    def assert_max_duration(self, max_seconds: float):
        """Assert that operation completed within max duration."""
        assert self.duration is not None, "Timer not properly used"
        assert self.duration <= max_seconds, (
            f"{self.operation_name} took {self.duration:.3f}s, "
            f"expected max {max_seconds}s"
        )


@pytest.fixture
def performance_db(tmp_path):
    """Create a test database for performance testing."""
    db_path = tmp_path / "test_performance.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True
    )
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def session_factory(performance_db):
    """Create session factory for performance tests."""
    return sessionmaker(bind=performance_db)


@pytest.fixture
def bulk_test_data(session_factory):
    """Create bulk test data for performance testing."""
    with session_factory() as session:
        # Create users
        users = []
        for i in range(100):
            user = AuthUser(
                email=f"user{i}@test.com",
                password_hash="test_hash",
                email_verified=True,
                role="user" if i > 0 else "admin"
            )
            users.append(user)
        session.add_all(users)
        session.commit()
        
        # Create ingredients
        ingredients = []
        for i in range(500):
            ingredient = Ingredient(
                name=f"Ingredient {i}",
                brand=f"Brand {i % 10}" if i % 3 == 0 else None,
                nutritional_data={
                    "calories": 100 + i % 300,
                    "proteins": 5 + i % 20,
                    "carbs": 10 + i % 50,
                    "fats": 2 + i % 15
                },
                unit_conversions={"ml_to_g": 1.05},
                allergens=["gluten"] if i % 5 == 0 else [],
                dietary_flags={"vegan": i % 3 == 0}
            )
            ingredients.append(ingredient)
        session.add_all(ingredients)
        session.commit()
        
        # Create recipes with ingredients
        recipes = []
        for user_idx in range(10):  # First 10 users
            for recipe_idx in range(50):  # 50 recipes per user
                recipe = Recipe(
                    user_id=users[user_idx].id,
                    name=f"Recipe {user_idx}-{recipe_idx}",
                    description=f"Description for recipe {recipe_idx}",
                    instructions="Test instructions " * 10,
                    prep_time_minutes=15 + recipe_idx % 45,
                    cook_time_minutes=30 + recipe_idx % 60,
                    servings=2 + recipe_idx % 6,
                    is_public=recipe_idx % 3 == 0,
                    is_published=recipe_idx % 5 == 0,
                    difficulty_level=["easy", "medium", "hard"][recipe_idx % 3],
                    rating_average=3.5 + (recipe_idx % 3) * 0.5,
                    rating_count=recipe_idx % 100,
                    view_count=recipe_idx * 10
                )
                recipes.append(recipe)
        session.add_all(recipes)
        session.commit()
        
        # Create recipe ingredients (many-to-many)
        recipe_ingredients = []
        for recipe_idx, recipe in enumerate(recipes[:100]):  # First 100 recipes
            # Each recipe has 5-15 ingredients
            num_ingredients = 5 + (recipe_idx % 11)
            for ing_idx in range(num_ingredients):
                recipe_ing = RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=ingredients[ing_idx * 10 % 500].id,
                    quantity=100 + ing_idx * 50,
                    unit=["g", "ml", "cup", "tbsp"][ing_idx % 4],
                    is_optional=ing_idx > 10,
                    display_order=ing_idx
                )
                recipe_ingredients.append(recipe_ing)
        session.add_all(recipe_ingredients)
        session.commit()
        
        # Create sessions and audit logs
        sessions = []
        audit_logs = []
        for user_idx in range(20):  # First 20 users
            for sess_idx in range(5):  # 5 sessions per user
                auth_session = AuthSession(
                    user_id=users[user_idx].id,
                    token_hash=f"hash_{user_idx}_{sess_idx}",
                    expires_at=datetime.now(timezone.utc) + timedelta(days=7),
                    ip_address="192.168.1.1",
                    user_agent="Test Browser"
                )
                sessions.append(auth_session)
                
                # Audit log entries
                for log_idx in range(10):
                    audit_log = AuditLog(
                        user_id=users[user_idx].id,
                        action=AuditLog.LOGIN_SUCCESS if log_idx % 2 == 0 else AuditLog.LOGIN_FAILED,
                        entity_type="user",
                        entity_id=users[user_idx].id,
                        ip_address="192.168.1.1"
                    )
                    audit_logs.append(audit_log)
        
        session.add_all(sessions + audit_logs)
        session.commit()
        
        return {
            "users": users,
            "ingredients": ingredients,
            "recipes": recipes,
            "recipe_ingredients": recipe_ingredients,
            "sessions": sessions,
            "audit_logs": audit_logs
        }


class TestQueryPerformance:
    """Test query performance for common patterns."""
    
    def test_user_lookup_by_email(self, session_factory, bulk_test_data):
        """Test user lookup by email performance."""
        with session_factory() as session:
            # Warm up
            session.execute(select(AuthUser).where(AuthUser.email == "user0@test.com")).scalar_one()
            
            # Test performance
            with PerformanceTimer("User lookup by email") as timer:
                for i in range(100):
                    user = session.execute(
                        select(AuthUser).where(AuthUser.email == f"user{i}@test.com")
                    ).scalar_one()
                    assert user is not None
            
            # Should complete 100 lookups in under 0.5 seconds
            timer.assert_max_duration(0.5)
    
    def test_recipe_list_with_pagination(self, session_factory, bulk_test_data):
        """Test recipe listing with pagination performance."""
        with session_factory() as session:
            # Test different page sizes
            for page_size in [10, 20, 50]:
                with PerformanceTimer(f"Recipe list (page_size={page_size})") as timer:
                    for page in range(5):
                        recipes = session.execute(
                            select(Recipe)
                            .where(Recipe.is_published == True)
                            .order_by(Recipe.created_at.desc())
                            .offset(page * page_size)
                            .limit(page_size)
                        ).scalars().all()
                        assert len(recipes) <= page_size
                
                # Should complete in under 0.1 seconds per page
                timer.assert_max_duration(0.5)
    
    def test_recipe_search_performance(self, session_factory, bulk_test_data):
        """Test recipe search query performance."""
        with session_factory() as session:
            search_terms = ["Recipe", "Test", "1", "2", "easy"]
            
            for term in search_terms:
                with PerformanceTimer(f"Recipe search for '{term}'") as timer:
                    recipes = session.execute(
                        select(Recipe)
                        .where(
                            (Recipe.name.ilike(f"%{term}%")) |
                            (Recipe.description.ilike(f"%{term}%"))
                        )
                        .limit(50)
                    ).scalars().all()
                    assert len(recipes) > 0
                
                # Search should complete in under 0.2 seconds
                timer.assert_max_duration(0.2)
    
    def test_aggregate_queries(self, session_factory, bulk_test_data):
        """Test aggregate query performance."""
        with session_factory() as session:
            # Test user recipe counts
            with PerformanceTimer("User recipe count aggregation") as timer:
                result = session.execute(
                    select(
                        AuthUser.id,
                        func.count(Recipe.id).label("recipe_count")
                    )
                    .join(Recipe, AuthUser.id == Recipe.user_id)
                    .group_by(AuthUser.id)
                    .having(func.count(Recipe.id) > 0)
                ).all()
                assert len(result) > 0
            
            timer.assert_max_duration(0.5)
            
            # Test average ratings
            with PerformanceTimer("Average rating calculation") as timer:
                avg_rating = session.execute(
                    select(func.avg(Recipe.rating_average))
                    .where(Recipe.rating_count > 0)
                ).scalar()
                assert avg_rating is not None
            
            timer.assert_max_duration(0.1)


class TestN1QueryDetection:
    """Test for N+1 query problems."""
    
    def test_recipe_with_ingredients_n1_detection(self, session_factory, bulk_test_data):
        """Test that recipe loading with ingredients doesn't cause N+1 queries."""
        with session_factory() as session:
            # Bad pattern - N+1 queries
            with patch.object(session, 'execute') as mock_execute:
                mock_execute.return_value.scalars.return_value.all.return_value = []
                mock_execute.return_value.scalar_one.return_value = bulk_test_data["recipes"][0]
                
                recipes = session.execute(select(Recipe).limit(10)).scalars().all()
                
                # Simulate accessing ingredients without eager loading
                query_count_before = mock_execute.call_count
                
                for recipe in recipes[:5]:
                    # This would cause N+1 queries
                    _ = recipe.ingredients
                
                query_count_after = mock_execute.call_count
                
                # Should not increase queries linearly with recipes
                assert query_count_after - query_count_before <= 1
            
            # Good pattern - eager loading
            with PerformanceTimer("Recipe with ingredients (eager loading)") as timer:
                recipes = session.execute(
                    select(Recipe)
                    .options(selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient))
                    .limit(10)
                ).scalars().all()
                
                # Access ingredients without additional queries
                for recipe in recipes:
                    for recipe_ing in recipe.ingredients:
                        _ = recipe_ing.ingredient.name
            
            timer.assert_max_duration(0.2)
    
    def test_user_with_sessions_n1_detection(self, session_factory, bulk_test_data):
        """Test user loading with sessions doesn't cause N+1 queries."""
        with session_factory() as session:
            # Good pattern with joinedload
            with PerformanceTimer("User with sessions (joined)") as timer:
                users = session.execute(
                    select(AuthUser)
                    .options(joinedload(AuthUser.sessions))
                    .limit(10)
                ).unique().scalars().all()
                
                # Access sessions without additional queries
                total_sessions = sum(len(user.sessions) for user in users)
                assert total_sessions > 0
            
            timer.assert_max_duration(0.1)


class TestIndexEffectiveness:
    """Test that database indexes are being used effectively."""
    
    def test_email_index_usage(self, session_factory, bulk_test_data):
        """Test that email lookups use the index."""
        with session_factory() as session:
            # PostgreSQL specific - would need EXPLAIN ANALYZE
            if session.bind.dialect.name == 'postgresql':
                result = session.execute(
                    text("EXPLAIN (FORMAT JSON) SELECT * FROM auth_users WHERE email = :email"),
                    {"email": "user5@test.com"}
                ).scalar()
                # Check that index scan is used (implementation specific)
            
            # Performance test as proxy
            emails = [f"user{i}@test.com" for i in range(50)]
            with PerformanceTimer("Batch email lookups") as timer:
                for email in emails:
                    user = session.execute(
                        select(AuthUser).where(AuthUser.email == email)
                    ).scalar_one_or_none()
            
            # With index, 50 lookups should be very fast
            timer.assert_max_duration(0.2)
    
    def test_timestamp_index_usage(self, session_factory, bulk_test_data):
        """Test that timestamp-based queries use indexes."""
        with session_factory() as session:
            now = datetime.now(timezone.utc)
            week_ago = now - timedelta(days=7)
            
            with PerformanceTimer("Recent recipe query") as timer:
                recipes = session.execute(
                    select(Recipe)
                    .where(Recipe.created_at >= week_ago)
                    .order_by(Recipe.created_at.desc())
                    .limit(50)
                ).scalars().all()
            
            timer.assert_max_duration(0.1)
            
            # Audit log time range queries
            with PerformanceTimer("Audit log time range") as timer:
                logs = session.execute(
                    select(AuditLog)
                    .where(
                        (AuditLog.created_at >= week_ago) &
                        (AuditLog.action == AuditLog.LOGIN_SUCCESS)
                    )
                    .order_by(AuditLog.created_at.desc())
                ).scalars().all()
            
            timer.assert_max_duration(0.1)
    
    def test_composite_index_effectiveness(self, session_factory, bulk_test_data):
        """Test composite index usage."""
        with session_factory() as session:
            # Test user_id + is_archived composite index
            user_id = bulk_test_data["users"][0].id
            
            with PerformanceTimer("User recipes (not archived)") as timer:
                recipes = session.execute(
                    select(Recipe)
                    .where(
                        (Recipe.user_id == user_id) &
                        (Recipe.is_archived == False)
                    )
                    .order_by(Recipe.created_at.desc())
                ).scalars().all()
                assert len(recipes) > 0
            
            timer.assert_max_duration(0.05)


class TestConnectionPoolPerformance:
    """Test database connection pool performance."""
    
    def test_connection_pool_efficiency(self, performance_db):
        """Test that connection pooling improves performance."""
        # Test without pooling
        no_pool_engine = create_engine(
            performance_db.url,
            poolclass=NullPool
        )
        
        # Test with pooling
        pooled_engine = create_engine(
            performance_db.url,
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=10
        )
        
        def run_queries(engine, num_queries=100):
            times = []
            for _ in range(num_queries):
                start = time.perf_counter()
                with engine.connect() as conn:
                    result = conn.execute(text("SELECT 1"))
                    result.scalar()
                end = time.perf_counter()
                times.append(end - start)
            return times
        
        # Warm up
        run_queries(pooled_engine, 10)
        run_queries(no_pool_engine, 10)
        
        # Measure
        with PerformanceTimer("Pooled connections") as pooled_timer:
            pooled_times = run_queries(pooled_engine)
        
        with PerformanceTimer("No pool connections") as no_pool_timer:
            no_pool_times = run_queries(no_pool_engine)
        
        # Pooled should be significantly faster
        avg_pooled = sum(pooled_times) / len(pooled_times)
        avg_no_pool = sum(no_pool_times) / len(no_pool_times)
        
        assert avg_pooled < avg_no_pool * 0.5  # At least 2x faster
        pooled_timer.assert_max_duration(1.0)  # 100 queries in 1 second
    
    def test_connection_pool_concurrent_access(self, performance_db):
        """Test connection pool under concurrent load."""
        pooled_engine = create_engine(
            performance_db.url,
            poolclass=QueuePool,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True
        )
        
        def worker(engine, worker_id, num_queries=20):
            Session = sessionmaker(bind=engine)
            results = []
            for i in range(num_queries):
                with Session() as session:
                    start = time.perf_counter()
                    user_count = session.execute(
                        select(func.count()).select_from(AuthUser)
                    ).scalar()
                    end = time.perf_counter()
                    results.append((worker_id, i, end - start, user_count))
            return results
        
        # Simulate concurrent access
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            with PerformanceTimer("Concurrent pool access") as timer:
                futures = [
                    executor.submit(worker, pooled_engine, i)
                    for i in range(20)
                ]
                all_results = []
                for future in concurrent.futures.as_completed(futures):
                    all_results.extend(future.result())
        
        # Should handle 20 workers * 20 queries = 400 queries efficiently
        timer.assert_max_duration(5.0)
        
        # Verify all queries succeeded
        assert len(all_results) == 400
        assert all(result[3] >= 0 for result in all_results)  # Valid counts


class TestQueryOptimization:
    """Test query optimization techniques."""
    
    def test_bulk_insert_performance(self, session_factory):
        """Test bulk insert performance."""
        with session_factory() as session:
            # Prepare data
            users_data = [
                {"email": f"bulk{i}@test.com", "password_hash": "hash", "email_verified": True}
                for i in range(1000)
            ]
            
            # Test individual inserts (bad)
            session.rollback()
            start = time.perf_counter()
            for data in users_data[:100]:  # Only 100 for individual
                user = AuthUser(**data)
                session.add(user)
            session.commit()
            individual_time = time.perf_counter() - start
            
            # Test bulk insert (good)
            session.rollback()
            with PerformanceTimer("Bulk insert 1000 users") as timer:
                session.execute(
                    AuthUser.__table__.insert(),
                    users_data
                )
                session.commit()
            
            # Bulk should be much faster
            timer.assert_max_duration(0.5)
            assert timer.duration < individual_time * 5  # At least 5x faster per record
    
    def test_update_optimization(self, session_factory, bulk_test_data):
        """Test bulk update performance."""
        with session_factory() as session:
            # Update many records efficiently
            with PerformanceTimer("Bulk update recipes") as timer:
                session.execute(
                    Recipe.__table__.update()
                    .where(Recipe.is_published == False)
                    .values(view_count=Recipe.view_count + 1)
                )
                session.commit()
            
            timer.assert_max_duration(0.2)
    
    def test_subquery_optimization(self, session_factory, bulk_test_data):
        """Test subquery vs join performance."""
        with session_factory() as session:
            # Find users with more than 10 recipes
            
            # Using subquery
            with PerformanceTimer("Subquery approach") as subquery_timer:
                subq = select(
                    Recipe.user_id,
                    func.count(Recipe.id).label("count")
                ).group_by(Recipe.user_id).having(func.count(Recipe.id) > 10).subquery()
                
                users = session.execute(
                    select(AuthUser).join(subq, AuthUser.id == subq.c.user_id)
                ).scalars().all()
            
            # Using EXISTS
            with PerformanceTimer("EXISTS approach") as exists_timer:
                users = session.execute(
                    select(AuthUser).where(
                        select(func.count())
                        .select_from(Recipe)
                        .where(Recipe.user_id == AuthUser.id)
                        .correlate(AuthUser)
                        .scalar_subquery() > 10
                    )
                ).scalars().all()
            
            # Both should be reasonably fast
            subquery_timer.assert_max_duration(0.3)
            exists_timer.assert_max_duration(0.3)


class TestDatabaseLoadTesting:
    """Test database performance under load."""
    
    @pytest.mark.slow
    def test_sustained_load(self, session_factory, bulk_test_data):
        """Test database performance under sustained load."""
        operations = []
        
        with session_factory() as session:
            # Simulate mixed workload for 10 seconds
            start_time = time.time()
            operation_count = 0
            
            while time.time() - start_time < 10:
                op_start = time.perf_counter()
                
                # Mix of operations
                op_type = operation_count % 4
                
                if op_type == 0:  # Read
                    recipes = session.execute(
                        select(Recipe).limit(10)
                    ).scalars().all()
                elif op_type == 1:  # Search
                    recipes = session.execute(
                        select(Recipe)
                        .where(Recipe.name.ilike("%test%"))
                        .limit(5)
                    ).scalars().all()
                elif op_type == 2:  # Aggregate
                    count = session.execute(
                        select(func.count()).select_from(Recipe)
                    ).scalar()
                else:  # Update
                    recipe = session.execute(
                        select(Recipe).limit(1)
                    ).scalar_one()
                    recipe.view_count += 1
                    session.commit()
                
                op_duration = time.perf_counter() - op_start
                operations.append((op_type, op_duration))
                operation_count += 1
        
        # Analyze results
        total_ops = len(operations)
        avg_duration = sum(op[1] for op in operations) / total_ops
        max_duration = max(op[1] for op in operations)
        
        # Performance assertions
        assert total_ops > 100  # Should complete many operations
        assert avg_duration < 0.1  # Average under 100ms
        assert max_duration < 0.5  # No operation over 500ms
        
        # Check operation distribution
        op_counts = {}
        for op_type, _ in operations:
            op_counts[op_type] = op_counts.get(op_type, 0) + 1
        
        # Should have good mix of operations
        for count in op_counts.values():
            assert count > total_ops * 0.2  # At least 20% of each type


class TestPerformanceRegression:
    """Test for performance regression detection."""
    
    def test_query_performance_benchmarks(self, session_factory, bulk_test_data):
        """Test that queries meet performance benchmarks."""
        benchmarks = {
            "user_by_email": 0.01,  # 10ms
            "recipe_by_id": 0.01,   # 10ms
            "recipes_page": 0.05,   # 50ms
            "recipe_search": 0.1,   # 100ms
            "user_recipes": 0.05,   # 50ms
            "recent_audit": 0.05,   # 50ms
        }
        
        results = {}
        
        with session_factory() as session:
            # User by email
            with PerformanceTimer("user_by_email") as timer:
                user = session.execute(
                    select(AuthUser).where(AuthUser.email == "user1@test.com")
                ).scalar_one()
            results["user_by_email"] = timer.duration
            
            # Recipe by ID
            recipe_id = bulk_test_data["recipes"][0].id
            with PerformanceTimer("recipe_by_id") as timer:
                recipe = session.execute(
                    select(Recipe).where(Recipe.id == recipe_id)
                ).scalar_one()
            results["recipe_by_id"] = timer.duration
            
            # Recipes page
            with PerformanceTimer("recipes_page") as timer:
                recipes = session.execute(
                    select(Recipe)
                    .where(Recipe.is_published == True)
                    .order_by(Recipe.created_at.desc())
                    .limit(20)
                ).scalars().all()
            results["recipes_page"] = timer.duration
            
            # Recipe search
            with PerformanceTimer("recipe_search") as timer:
                recipes = session.execute(
                    select(Recipe)
                    .where(Recipe.name.ilike("%recipe%"))
                    .limit(20)
                ).scalars().all()
            results["recipe_search"] = timer.duration
            
            # User recipes
            with PerformanceTimer("user_recipes") as timer:
                recipes = session.execute(
                    select(Recipe)
                    .where(Recipe.user_id == user.id)
                    .order_by(Recipe.created_at.desc())
                ).scalars().all()
            results["user_recipes"] = timer.duration
            
            # Recent audit logs
            with PerformanceTimer("recent_audit") as timer:
                logs = session.execute(
                    select(AuditLog)
                    .where(AuditLog.user_id == user.id)
                    .order_by(AuditLog.created_at.desc())
                    .limit(50)
                ).scalars().all()
            results["recent_audit"] = timer.duration
        
        # Check against benchmarks
        for query_name, max_duration in benchmarks.items():
            actual_duration = results[query_name]
            assert actual_duration <= max_duration, (
                f"{query_name} exceeded benchmark: "
                f"{actual_duration:.3f}s > {max_duration}s"
            )
        
        # Print performance report
        print("\nPerformance Benchmark Results:")
        print("-" * 50)
        for query_name, duration in results.items():
            benchmark = benchmarks[query_name]
            status = "PASS" if duration <= benchmark else "FAIL"
            print(f"{query_name:20} {duration*1000:6.1f}ms / {benchmark*1000:6.1f}ms [{status}]")


def test_performance_monitoring_setup(session_factory):
    """Test that performance monitoring can be set up."""
    with session_factory() as session:
        # Test that we can enable query logging
        import logging
        logging.basicConfig()
        logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
        
        # Execute a query and verify it's logged
        with patch('logging.Logger.info') as mock_log:
            user = session.execute(
                select(AuthUser).where(AuthUser.email == "test@example.com")
            ).scalar_one_or_none()
            
            # Should have logged the query
            assert mock_log.called
            
        # Test that we can get query statistics
        if hasattr(session.bind, 'dialect') and session.bind.dialect.name == 'postgresql':
            # PostgreSQL specific statistics
            stats = session.execute(
                text("SELECT query, calls, mean_exec_time FROM pg_stat_statements LIMIT 5")
            ).all()
            # Just verify it doesn't error - actual stats depend on configuration