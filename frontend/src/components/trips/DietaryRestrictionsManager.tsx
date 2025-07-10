import React, { useState, useMemo } from 'react'
import { 
  Utensils, 
  AlertTriangle, 
  Filter, 
  Users, 
  Info,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Wheat,
  Milk,
  Fish,
  Egg,
  TreePine,
  Beef
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { Participant } from '@/store/slices/tripStore'

interface DietaryRestrictionsManagerProps {
  participants: Array<Participant & { 
    dietaryRestrictions?: string[]
    allergies?: string[]
    isActive?: boolean
  }>
  onFilterByRestriction?: (restriction: string) => void
  className?: string
}

interface RestrictionSummary {
  name: string
  count: number
  participants: string[]
  severity: 'info' | 'warning' | 'critical'
  icon?: React.ReactNode
  description?: string
}

const allergyIcons: Record<string, React.ReactNode> = {
  'Nut allergy': <TreePine className="w-4 h-4" />,
  'Seafood allergy': <Fish className="w-4 h-4" />,
  'Dairy-free': <Milk className="w-4 h-4" />,
  'Gluten-free': <Wheat className="w-4 h-4" />,
  'Egg allergy': <Egg className="w-4 h-4" />,
  'Meat allergy': <Beef className="w-4 h-4" />
}

const restrictionDescriptions: Record<string, string> = {
  'Vegetarian': 'No meat or fish products',
  'Vegan': 'No animal products including dairy and eggs',
  'Gluten-free': 'No wheat, barley, rye, or related grains',
  'Dairy-free': 'No milk, cheese, yogurt, or other dairy products',
  'Nut allergy': 'Severe allergy - avoid all tree nuts and peanuts',
  'Seafood allergy': 'Avoid all fish and shellfish',
  'Halal': 'Prepared according to Islamic dietary laws',
  'Kosher': 'Prepared according to Jewish dietary laws',
  'Low carb': 'Limited carbohydrates, focus on proteins and fats',
  'Diabetic': 'Controlled sugar and carbohydrate intake'
}

export const DietaryRestrictionsManager: React.FC<DietaryRestrictionsManagerProps> = ({
  participants,
  onFilterByRestriction,
  className
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['critical']))
  const [selectedRestriction, setSelectedRestriction] = useState<string | null>(null)

  const activeParticipants = participants.filter(p => p.isActive !== false)

  const restrictionSummary = useMemo(() => {
    const summary: Record<string, RestrictionSummary> = {}
    
    activeParticipants.forEach(participant => {
      const allRestrictions = [
        ...(participant.dietaryRestrictions || []),
        ...(participant.allergies || [])
      ]
      
      allRestrictions.forEach(restriction => {
        if (!summary[restriction]) {
          summary[restriction] = {
            name: restriction,
            count: 0,
            participants: [],
            severity: 'info',
            icon: allergyIcons[restriction],
            description: restrictionDescriptions[restriction]
          }
        }
        
        summary[restriction].count++
        summary[restriction].participants.push(participant.name)
        
        // Determine severity
        if (restriction.includes('allergy') || restriction.includes('Allergy')) {
          summary[restriction].severity = 'critical'
        } else if (['Vegan', 'Halal', 'Kosher'].includes(restriction)) {
          summary[restriction].severity = 'warning'
        }
      })
    })
    
    return Object.values(summary).sort((a, b) => {
      // Sort by severity first, then by count
      const severityOrder = { critical: 0, warning: 1, info: 2 }
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity]
      }
      return b.count - a.count
    })
  }, [activeParticipants])

  const groupedRestrictions = useMemo(() => {
    return {
      critical: restrictionSummary.filter(r => r.severity === 'critical'),
      warning: restrictionSummary.filter(r => r.severity === 'warning'),
      info: restrictionSummary.filter(r => r.severity === 'info')
    }
  }, [restrictionSummary])

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const handleRestrictionClick = (restriction: string) => {
    if (selectedRestriction === restriction) {
      setSelectedRestriction(null)
      onFilterByRestriction?.('')
    } else {
      setSelectedRestriction(restriction)
      onFilterByRestriction?.(restriction)
    }
  }

  const totalRestrictions = restrictionSummary.length
  const affectedParticipants = new Set(
    restrictionSummary.flatMap(r => r.participants)
  ).size

  if (totalRestrictions === 0) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <Utensils className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            No dietary restrictions or allergies reported
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="w-5 h-5" />
            Dietary Restrictions Overview
          </CardTitle>
          <CardDescription>
            {affectedParticipants} of {activeParticipants.length} participants have dietary requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-3xl font-bold text-red-600">{groupedRestrictions.critical.length}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Critical Allergies</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-3xl font-bold text-orange-600">{groupedRestrictions.warning.length}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Strict Requirements</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{groupedRestrictions.info.length}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Preferences</p>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Coverage</span>
              <span>{Math.round((affectedParticipants / activeParticipants.length) * 100)}%</span>
            </div>
            <Progress 
              value={(affectedParticipants / activeParticipants.length) * 100} 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Critical Allergies */}
      {groupedRestrictions.critical.length > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Critical Allergies Present</AlertTitle>
          <AlertDescription>
            These participants have severe allergies that require careful attention during meal planning
          </AlertDescription>
        </Alert>
      )}

      {/* Restriction Groups */}
      {Object.entries(groupedRestrictions).map(([severity, restrictions]) => {
        if (restrictions.length === 0) return null
        
        const isExpanded = expandedSections.has(severity)
        const severityConfig = {
          critical: {
            title: 'Critical Allergies',
            icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
            badgeVariant: 'destructive' as const
          },
          warning: {
            title: 'Strict Requirements',
            icon: <Info className="w-5 h-5 text-orange-600" />,
            badgeVariant: 'warning' as const
          },
          info: {
            title: 'Dietary Preferences',
            icon: <Utensils className="w-5 h-5 text-blue-600" />,
            badgeVariant: 'secondary' as const
          }
        }
        
        const config = severityConfig[severity as keyof typeof severityConfig]
        
        return (
          <Card key={severity}>
            <CardHeader 
              className="cursor-pointer"
              onClick={() => toggleSection(severity)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {config.icon}
                  {config.title}
                  <Badge variant={config.badgeVariant} className="ml-2">
                    {restrictions.length}
                  </Badge>
                </CardTitle>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </div>
            </CardHeader>
            
            {isExpanded && (
              <CardContent className="space-y-3">
                {restrictions.map((restriction) => (
                  <div
                    key={restriction.name}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedRestriction === restriction.name
                        ? "bg-primary-50 dark:bg-primary-950 border-primary-300"
                        : "hover:bg-gray-50 dark:hover:bg-gray-900"
                    )}
                    onClick={() => handleRestrictionClick(restriction.name)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {restriction.icon}
                          <h4 className="font-medium">{restriction.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {restriction.count} {restriction.count === 1 ? 'person' : 'people'}
                          </Badge>
                        </div>
                        
                        {restriction.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {restriction.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600 dark:text-gray-400">
                            {restriction.participants.join(', ')}
                          </span>
                        </div>
                      </div>
                      
                      {selectedRestriction === restriction.name && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRestrictionClick(restriction.name)
                          }}
                        >
                          <Filter className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Meal Planning Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {groupedRestrictions.critical.length > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                <span>Always check ingredients for allergens and prepare allergy-safe options separately</span>
              </li>
            )}
            {restrictionSummary.some(r => r.name === 'Vegan') && (
              <li className="flex items-start gap-2">
                <span className="text-orange-600">•</span>
                <span>Ensure vegan protein sources are available at every meal</span>
              </li>
            )}
            {restrictionSummary.some(r => ['Halal', 'Kosher'].includes(r.name)) && (
              <li className="flex items-start gap-2">
                <span className="text-orange-600">•</span>
                <span>Source certified ingredients for religious dietary requirements</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Label all dishes clearly with ingredients and allergen information</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Consider having a variety of options to accommodate multiple restrictions</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}