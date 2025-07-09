"""
Debug participant scaling calculation.
"""

import sys
sys.path.insert(0, 'src')

from decimal import Decimal
from jidelnicek.recipe.utils.scaling import ParticipantScaler


def debug_participant_scaling():
    """Debug the participant scaling issue."""
    scaler = ParticipantScaler(use_rounding=False, use_constraints=False)
    
    participants_meal = [
        {'name': 'Athlete', 'coefficient': 150, 'meal_coefficients': {'Lunch': 175}},
        {'name': 'Regular', 'coefficient': 100}
    ]
    
    print("Debugging participant scaling with meal coefficients:")
    print(f"Participants: {participants_meal}")
    
    # Calculate without meal type
    base_effective = scaler.calculate_effective_participants(participants_meal)
    print(f"\nBase effective participants: {base_effective}")
    print(f"  Athlete: 150% = 1.5")
    print(f"  Regular: 100% = 1.0")
    print(f"  Expected: 1.5 + 1.0 = 2.5")
    
    # Calculate with Lunch meal type
    lunch_effective = scaler.calculate_effective_participants(participants_meal, 'Lunch')
    print(f"\nLunch effective participants: {lunch_effective}")
    print(f"  Athlete at Lunch: 150% base, but should use 175% meal coefficient")
    print(f"  Regular: 100% = 1.0")
    print(f"  Expected: 1.75 + 1.0 = 2.75")
    
    # Let's trace through the calculation
    print("\nDetailed calculation:")
    for p in participants_meal:
        base_coef = Decimal(str(p['coefficient']))
        print(f"\n{p['name']}:")
        print(f"  Base coefficient: {base_coef}%")
        
        if 'Lunch' in p.get('meal_coefficients', {}):
            meal_coef = Decimal(str(p['meal_coefficients']['Lunch']))
            print(f"  Lunch coefficient: {meal_coef}%")
            print(f"  Should use meal coefficient for Lunch")
        else:
            print(f"  No Lunch coefficient, using base")
        
        # Calculate effective coefficient
        coefficient = base_coef
        if 'Lunch' in p.get('meal_coefficients', {}):
            coefficient = Decimal(str(p['meal_coefficients']['Lunch']))
        
        effective = coefficient / Decimal('100')
        print(f"  Effective contribution: {effective}")


if __name__ == '__main__':
    debug_participant_scaling()