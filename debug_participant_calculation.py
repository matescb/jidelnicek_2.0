#!/usr/bin/env python3
"""
Debug participant coefficient calculation issue.
"""

import sys
from pathlib import Path
from decimal import Decimal, getcontext

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Set decimal precision for tests
getcontext().prec = 28

from jidelnicek.recipe.utils.scaling import ParticipantScaler

def debug_participant_calculation():
    """Debug the participant coefficient calculation."""
    scaler = ParticipantScaler(use_rounding=False, use_constraints=False)
    
    participants = [
        {'name': 'Adult 1', 'coefficient': 100},
        {'name': 'Adult 2', 'coefficient': 120},
        {'name': 'Child 1', 'coefficient': 75},
        {'name': 'Child 2', 'coefficient': 60},
        {'name': 'Athlete', 'coefficient': 150, 'meal_coefficients': {'Lunch': 175}},
        {'name': 'Elderly', 'coefficient': 85, 'attendance_factor': Decimal('0.8')}
    ]
    
    print("Debugging participant coefficient calculation...")
    print()
    
    # Calculate base effective participants
    print("Base calculation (no meal type):")
    effective_base = scaler.calculate_effective_participants(participants)
    print(f"Actual result: {effective_base}")
    
    # Manual calculation for verification
    print("\nManual calculation:")
    total = Decimal('0')
    for p in participants:
        coeff = Decimal(str(p['coefficient'])) / Decimal('100')
        attendance = Decimal(str(p.get('attendance_factor', 1)))
        effective = coeff * attendance
        print(f"  {p['name']}: {p['coefficient']}% * {attendance} = {effective}")
        total += effective
    
    print(f"Manual total: {total}")
    print(f"Expected: 5.73")
    print()
    
    # Calculate with meal-specific coefficient
    print("Lunch calculation:")
    effective_lunch = scaler.calculate_effective_participants(participants, 'Lunch')
    print(f"Actual result: {effective_lunch}")
    
    # Manual calculation for lunch
    print("\nManual lunch calculation:")
    total_lunch = Decimal('0')
    for p in participants:
        base_coeff = Decimal(str(p['coefficient']))
        
        # Check for meal-specific coefficient
        if 'meal_coefficients' in p and 'Lunch' in p['meal_coefficients']:
            coeff = Decimal(str(p['meal_coefficients']['Lunch'])) / Decimal('100')
            print(f"  {p['name']}: meal-specific {p['meal_coefficients']['Lunch']}% = {coeff}")
        else:
            coeff = base_coeff / Decimal('100')
            print(f"  {p['name']}: base {p['coefficient']}% = {coeff}")
        
        attendance = Decimal(str(p.get('attendance_factor', 1)))
        effective = coeff * attendance
        print(f"    Final: {coeff} * {attendance} = {effective}")
        total_lunch += effective
    
    print(f"Manual lunch total: {total_lunch}")
    print(f"Expected: 6.855")
    
    # Check if there's a bug in the meal coefficient logic
    print("\nChecking athlete meal coefficient logic:")
    athlete = participants[4]
    print(f"Athlete base coefficient: {athlete['coefficient']}")
    print(f"Athlete meal coefficients: {athlete.get('meal_coefficients', {})}")
    
    # Test the meal coefficient logic directly
    base_coeff = Decimal(str(athlete['coefficient']))
    print(f"Base coefficient as decimal: {base_coeff}")
    
    meal_coeffs = athlete.get('meal_coefficients', {})
    if 'Lunch' in meal_coeffs:
        lunch_coeff = Decimal(str(meal_coeffs['Lunch']))
        print(f"Lunch coefficient: {lunch_coeff}")
        print(f"Expected effective portion: {lunch_coeff / Decimal('100')} = {lunch_coeff / Decimal('100')}")
        
        # This should be 175% = 1.75, but maybe there's confusion about how to apply it
        # Let's check if it's being applied as a multiplier vs replacement
        print(f"If multiplier: {base_coeff} * {lunch_coeff} / 100 / 100 = {base_coeff * lunch_coeff / Decimal('10000')}")
        print(f"If replacement: {lunch_coeff} / 100 = {lunch_coeff / Decimal('100')}")


if __name__ == "__main__":
    debug_participant_calculation()