"""
Ingredient management API endpoints for administrators.

This module provides comprehensive CRUD operations, bulk management,
moderation, and quality control for ingredients.
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import io

from jidelnicek.core.database import get_db
from jidelnicek.auth.dependencies import get_current_user, require_admin
from jidelnicek.auth.models import AuthUser
from jidelnicek.admin.services.ingredient_management import IngredientManagementService
from jidelnicek.admin.schemas.ingredients import (
    IngredientCreate, IngredientUpdate, IngredientResponse,
    IngredientListResponse, IngredientFilter, IngredientSort,
    IngredientMergeRequest, IngredientBulkOperation,
    IngredientImportRequest, IngredientImportResult,
    IngredientExportRequest, IngredientQualityReport,
    IngredientUsageStats, IngredientModerationRequest,
    IngredientModerationReview, IngredientModerationQueue,
    IngredientDashboard
)
from jidelnicek.core.exceptions import NotFoundError, ConflictError, ValidationError


router = APIRouter(
    prefix="/admin/ingredients",
    tags=["admin-ingredients"],
    dependencies=[Depends(require_admin)]
)


@router.post("/", response_model=IngredientResponse)
async def create_ingredient(
    ingredient: IngredientCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Create a new ingredient.
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    
    try:
        created_ingredient = await service.create_ingredient(
            name=ingredient.name,
            category=ingredient.category,
            brand=ingredient.brand,
            barcode=ingredient.barcode,
            nutritional_data=ingredient.nutritional_data.model_dump(),
            unit_conversions=ingredient.unit_conversions,
            allergens=ingredient.allergens,
            dietary_flags=ingredient.dietary_flags,
            is_global=ingredient.is_global
        )
        
        return IngredientResponse.model_validate(created_ingredient)
        
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=IngredientListResponse)
async def list_ingredients(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    query: Optional[str] = None,
    category: Optional[str] = None,
    brand: Optional[str] = None,
    is_global: Optional[bool] = None,
    is_archived: bool = False,
    sort_by: str = "name",
    sort_order: str = "asc",
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    List ingredients with filtering and pagination.
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    
    ingredients, total = await service.search_ingredients(
        query=query,
        category=category,
        brand=brand,
        is_global=is_global,
        is_archived=is_archived,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        sort_order=sort_order
    )
    
    # Calculate statistics
    stats = {
        "total": total,
        "global": sum(1 for i in ingredients if i.is_global),
        "user_specific": sum(1 for i in ingredients if not i.is_global),
        "archived": sum(1 for i in ingredients if i.is_archived)
    }
    
    return IngredientListResponse(
        ingredients=ingredients,
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page,
        stats=stats
    )


@router.get("/categories", response_model=List[str])
async def get_categories(
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Get all unique ingredient categories.
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    return await service.get_categories()


@router.get("/dashboard", response_model=IngredientDashboard)
async def get_ingredient_dashboard(
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Get ingredient management dashboard data.
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    
    # Get total counts
    all_ingredients, total = await service.search_ingredients(
        is_archived=True,  # Include archived
        per_page=1  # Just need count
    )
    
    global_ingredients, global_count = await service.search_ingredients(
        is_global=True,
        per_page=1
    )
    
    user_ingredients, user_count = await service.search_ingredients(
        is_global=False,
        per_page=1
    )
    
    archived_ingredients, archived_count = await service.search_ingredients(
        is_archived=True,
        per_page=1
    )
    
    # Get recent submissions
    recent_ingredients, _ = await service.search_ingredients(
        sort_by="created_at",
        sort_order="desc",
        per_page=10
    )
    
    # Mock data for other stats (would be implemented in service)
    return IngredientDashboard(
        total_ingredients=total,
        global_ingredients=global_count,
        user_ingredients=user_count,
        archived_ingredients=archived_count,
        pending_moderation=0,  # Would come from moderation service
        approved_today=0,
        rejected_today=0,
        categories=[],  # Would be aggregated from database
        recent_submissions=recent_ingredients,
        quality_issues=[],  # Would be from quality checks
        popular_ingredients=[]  # Would be from usage stats
    )


@router.get("/{ingredient_id}", response_model=IngredientResponse)
async def get_ingredient(
    ingredient_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Get detailed information about a specific ingredient.
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    
    ingredient = await service.get_ingredient_by_id(ingredient_id)
    if not ingredient:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    
    # Get quality score
    quality_report = await service.validate_ingredient_quality(ingredient_id)
    
    response = IngredientResponse.model_validate(ingredient)
    response.quality_score = quality_report['quality_score']
    
    return response


@router.put("/{ingredient_id}", response_model=IngredientResponse)
async def update_ingredient(
    ingredient_id: UUID,
    update_data: IngredientUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Update an existing ingredient.
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    
    # Prepare update data
    data = {}
    if update_data.name is not None:
        data['name'] = update_data.name
    if update_data.brand is not None:
        data['brand'] = update_data.brand
    if update_data.barcode is not None:
        data['barcode'] = update_data.barcode
    if update_data.category is not None:
        data['category'] = update_data.category
    if update_data.nutritional_data is not None:
        data['nutritional_data'] = update_data.nutritional_data.model_dump()
    if update_data.unit_conversions is not None:
        data['unit_conversions'] = update_data.unit_conversions
    if update_data.allergens is not None:
        data['allergens'] = update_data.allergens
    if update_data.dietary_flags is not None:
        data['dietary_flags'] = update_data.dietary_flags
    
    try:
        updated_ingredient = await service.update_ingredient(ingredient_id, **data)
        return IngredientResponse.model_validate(updated_ingredient)
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{ingredient_id}")
async def delete_ingredient(
    ingredient_id: UUID,
    force: bool = Query(False, description="Force delete even if used in recipes"),
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Delete or archive an ingredient.
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    
    try:
        success = await service.delete_ingredient(ingredient_id, force=force)
        return {"success": success, "message": "Ingredient deleted successfully"}
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/merge", response_model=IngredientResponse)
async def merge_ingredients(
    merge_request: IngredientMergeRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Merge two ingredients into one.
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    
    try:
        merged_ingredient = await service.merge_ingredients(
            source_id=merge_request.source_id,
            target_id=merge_request.target_id,
            update_recipes=merge_request.update_recipes
        )
        return IngredientResponse.model_validate(merged_ingredient)
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/bulk", response_model=Dict[str, Any])
async def bulk_operation(
    operation: IngredientBulkOperation,
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Perform bulk operations on multiple ingredients.
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    
    results = {
        "total": len(operation.ingredient_ids),
        "success": 0,
        "failed": 0,
        "errors": []
    }
    
    for ingredient_id in operation.ingredient_ids:
        try:
            if operation.operation == "delete":
                await service.delete_ingredient(ingredient_id, force=True)
            elif operation.operation == "archive":
                await service.update_ingredient(ingredient_id, is_archived=True)
            elif operation.operation == "unarchive":
                await service.update_ingredient(ingredient_id, is_archived=False)
            
            results["success"] += 1
            
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "ingredient_id": str(ingredient_id),
                "error": str(e)
            })
    
    return results


@router.post("/import", response_model=IngredientImportResult)
async def import_ingredients(
    file: UploadFile = File(...),
    import_config: IngredientImportRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Import ingredients from CSV or JSON file.
    
    CSV Format:
    name,brand,barcode,category,calories,proteins,carbs,fats,allergens
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    
    if import_config.format != "csv":
        raise HTTPException(
            status_code=400,
            detail="Only CSV format is currently supported"
        )
    
    try:
        result = await service.bulk_import_csv(
            file=file,
            is_global=import_config.is_global
        )
        return IngredientImportResult(**result)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/export")
async def export_ingredients(
    export_config: IngredientExportRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Export ingredients to CSV or JSON format.
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    
    # Apply filters
    filters = {}
    if export_config.filters:
        filters = export_config.filters.model_dump(exclude_none=True)
    
    filters['is_archived'] = export_config.include_archived
    
    try:
        export_data = await service.bulk_export(
            format=export_config.format,
            filters=filters
        )
        
        # Set appropriate content type
        if export_config.format == "json":
            media_type = "application/json"
            filename = f"ingredients_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        else:
            media_type = "text/csv"
            filename = f"ingredients_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return StreamingResponse(
            io.BytesIO(export_data),
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ingredient_id}/quality", response_model=IngredientQualityReport)
async def check_ingredient_quality(
    ingredient_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Check quality and completeness of ingredient data.
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    
    try:
        quality_data = await service.validate_ingredient_quality(ingredient_id)
        
        # Add suggestions based on issues
        suggestions = []
        if "Missing nutritional data" in quality_data['issues']:
            suggestions.append("Add complete nutritional information")
        if "Missing category" in quality_data['issues']:
            suggestions.append("Assign an appropriate category")
        if "No allergen information" in quality_data['issues']:
            suggestions.append("Specify allergens or mark as allergen-free")
        
        return IngredientQualityReport(
            ingredient_id=ingredient_id,
            name=quality_data['name'],
            quality_score=quality_data['quality_score'],
            issues=quality_data['issues'],
            is_complete=quality_data['is_complete'],
            suggestions=suggestions
        )
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{ingredient_id}/usage", response_model=IngredientUsageStats)
async def get_ingredient_usage(
    ingredient_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Get usage statistics for an ingredient.
    
    Required admin permissions.
    """
    service = IngredientManagementService(db, admin_user)
    
    try:
        usage_data = await service.get_usage_statistics(ingredient_id)
        
        return IngredientUsageStats(
            ingredient_id=ingredient_id,
            name=usage_data['name'],
            total_recipes=usage_data['total_recipes'],
            total_users=0,  # Would be calculated from recipe owners
            recent_usage=usage_data['recent_usage'],
            created_at=usage_data['created_at'],
            updated_at=usage_data['updated_at']
        )
        
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Moderation endpoints would be implemented here
@router.get("/moderation/queue", response_model=IngredientModerationQueue)
async def get_moderation_queue(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Get ingredient moderation queue.
    
    Required admin permissions.
    """
    # This would be implemented with the moderation service
    return IngredientModerationQueue(
        items=[],
        total=0,
        page=page,
        per_page=per_page,
        pages=0,
        stats={
            "pending": 0,
            "approved": 0,
            "rejected": 0,
            "needs_review": 0
        }
    )


@router.post("/moderation/{ingredient_id}/review")
async def review_moderated_ingredient(
    ingredient_id: UUID,
    review: IngredientModerationReview,
    db: AsyncSession = Depends(get_db),
    admin_user: AuthUser = Depends(get_current_user)
):
    """
    Review and approve/reject a moderated ingredient.
    
    Required admin permissions.
    """
    # This would be implemented with the moderation service
    return {"success": True, "message": "Review submitted successfully"}