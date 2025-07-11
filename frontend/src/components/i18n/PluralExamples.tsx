/**
 * Examples demonstrating advanced i18n features
 * Shows usage of pluralization, context, and ordinal components
 */

import React, { useState } from 'react'
import {
  PluralText,
  ContextualText,
  OrdinalText,
  PluralContextText,
  usePlural,
  useContext,
  usePluralContext
} from './PluralComponents'
import { useTranslation } from '../../i18n/hooks/useTranslation'

/**
 * Pluralization Examples
 */
export const PluralizationExamples: React.FC = () => {
  const [recipeCount, setRecipeCount] = useState(1)
  const [participantCount, setParticipantCount] = useState(1)
  const { i18n } = useTranslation()
  
  const testCounts = [0, 1, 2, 3, 4, 5, 10, 11, 21, 22, 100, 101]
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Pluralization Examples ({i18n.language})</h2>
      
      {/* Interactive example */}
      <div className="p-4 border rounded">
        <h3 className="text-lg font-semibold mb-2">Interactive Example</h3>
        <div className="space-y-2">
          <div>
            <label>Recipe Count: </label>
            <input
              type="number"
              value={recipeCount}
              onChange={(e) => setRecipeCount(Number(e.target.value))}
              className="border px-2 py-1 rounded"
            />
          </div>
          <div>
            <PluralText i18nKey="plurals.recipe" count={recipeCount} />
          </div>
          <div>
            <PluralText i18nKey="plurals.recipeCount" count={recipeCount} />
          </div>
        </div>
      </div>
      
      {/* Test various counts */}
      <div className="p-4 border rounded">
        <h3 className="text-lg font-semibold mb-2">Count Tests</h3>
        <div className="grid grid-cols-2 gap-2">
          {testCounts.map(count => (
            <div key={count} className="text-sm">
              {count}: <PluralText i18nKey="plurals.day" count={count} />
            </div>
          ))}
        </div>
      </div>
      
      {/* Complex example */}
      <div className="p-4 border rounded">
        <h3 className="text-lg font-semibold mb-2">Complex Pluralization</h3>
        <div>
          <label>Participants: </label>
          <input
            type="number"
            value={participantCount}
            onChange={(e) => setParticipantCount(Number(e.target.value))}
            className="border px-2 py-1 rounded"
          />
        </div>
        <PluralText 
          i18nKey="plurals.recipesInTrip" 
          count={recipeCount}
          values={{ participants: participantCount }}
        />
      </div>
    </div>
  )
}

/**
 * Context Examples
 */
export const ContextExamples: React.FC = () => {
  const [gender, setGender] = useState<'masculine' | 'feminine' | 'neuter'>('masculine')
  const [formality, setFormality] = useState<'formal' | 'informal'>('informal')
  const name = 'Marie'
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Context Examples</h2>
      
      {/* Gender context */}
      <div className="p-4 border rounded">
        <h3 className="text-lg font-semibold mb-2">Gender Context</h3>
        <div className="space-y-2">
          <div>
            <label>Gender: </label>
            <select 
              value={gender} 
              onChange={(e) => setGender(e.target.value as any)}
              className="border px-2 py-1 rounded"
            >
              <option value="masculine">Masculine</option>
              <option value="feminine">Feminine</option>
              <option value="neuter">Neuter</option>
            </select>
          </div>
          <div>
            <ContextualText 
              i18nKey="contexts.userArrived" 
              context={{ gender }}
              values={{ name }}
            />
          </div>
          <div>
            <ContextualText 
              i18nKey="contexts.userCreated" 
              context={{ gender }}
              values={{ name }}
            />
          </div>
        </div>
      </div>
      
      {/* Formality context */}
      <div className="p-4 border rounded">
        <h3 className="text-lg font-semibold mb-2">Formality Context</h3>
        <div className="space-y-2">
          <div>
            <label>Formality: </label>
            <select 
              value={formality} 
              onChange={(e) => setFormality(e.target.value as any)}
              className="border px-2 py-1 rounded"
            >
              <option value="formal">Formal</option>
              <option value="informal">Informal</option>
            </select>
          </div>
          <div>
            <ContextualText 
              i18nKey="contexts.welcome" 
              context={{ formality }}
            />
          </div>
          <div>
            <ContextualText 
              i18nKey="contexts.greeting" 
              context={{ formality }}
              values={{ name }}
            />
          </div>
        </div>
      </div>
      
      {/* Combined context */}
      <div className="p-4 border rounded">
        <h3 className="text-lg font-semibold mb-2">Combined Context</h3>
        <div>
          <ContextualText 
            i18nKey="contexts.thankYou" 
            context={{ gender, formality }}
            values={{ name }}
          />
        </div>
        <div>
          <ContextualText 
            i18nKey="contexts.addressUser" 
            context={{ gender, formality }}
            values={{ name }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Ordinal Examples
 */
export const OrdinalExamples: React.FC = () => {
  const testNumbers = [1, 2, 3, 4, 5, 10, 11, 12, 13, 21, 22, 23, 100, 101]
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Ordinal Examples</h2>
      
      <div className="p-4 border rounded">
        <h3 className="text-lg font-semibold mb-2">Ordinal Numbers</h3>
        <div className="grid grid-cols-3 gap-2">
          {testNumbers.map(num => (
            <div key={num} className="text-sm">
              <OrdinalText value={num} />
            </div>
          ))}
        </div>
      </div>
      
      <div className="p-4 border rounded">
        <h3 className="text-lg font-semibold mb-2">Ordinal with Context</h3>
        <div className="space-y-1">
          <div><OrdinalText value={1} i18nKey="plurals.place" /></div>
          <div><OrdinalText value={2} i18nKey="plurals.floor" /></div>
          <div><OrdinalText value={3} i18nKey="plurals.attempt" /></div>
          <div><OrdinalText value={4} i18nKey="plurals.week" /></div>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook Usage Examples
 */
export const HookExamples: React.FC = () => {
  const { plural, ordinal } = usePlural()
  const { contextual } = useContext()
  const { pluralContext } = usePluralContext()
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Hook Usage Examples</h2>
      
      <div className="p-4 border rounded">
        <h3 className="text-lg font-semibold mb-2">usePlural Hook</h3>
        <div className="space-y-1">
          <div>1 recipe: {plural('plurals.recipe', 1)}</div>
          <div>5 recipes: {plural('plurals.recipe', 5)}</div>
          <div>1st place: {ordinal(1)}</div>
          <div>23rd place: {ordinal(23)}</div>
        </div>
      </div>
      
      <div className="p-4 border rounded">
        <h3 className="text-lg font-semibold mb-2">useContext Hook</h3>
        <div className="space-y-1">
          <div>
            Formal: {contextual('contexts.welcome', { formality: 'formal' })}
          </div>
          <div>
            Informal: {contextual('contexts.welcome', { formality: 'informal' })}
          </div>
        </div>
      </div>
      
      <div className="p-4 border rounded">
        <h3 className="text-lg font-semibold mb-2">usePluralContext Hook</h3>
        <div>
          {pluralContext('plurals.participantJoined', 2, { gender: 'feminine' })}
        </div>
      </div>
    </div>
  )
}

/**
 * Complete Example Page
 */
export const I18nAdvancedExamples: React.FC = () => {
  const { i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<'plural' | 'context' | 'ordinal' | 'hooks'>('plural')
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Advanced i18n Examples</h1>
      
      {/* Language Switcher */}
      <div className="mb-6">
        <label>Language: </label>
        <select 
          value={i18n.language} 
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="border px-3 py-1 rounded"
        >
          <option value="en">English</option>
          <option value="cs">Czech</option>
          <option value="ar">Arabic</option>
        </select>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          className={`pb-2 px-4 ${activeTab === 'plural' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('plural')}
        >
          Pluralization
        </button>
        <button
          className={`pb-2 px-4 ${activeTab === 'context' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('context')}
        >
          Context
        </button>
        <button
          className={`pb-2 px-4 ${activeTab === 'ordinal' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('ordinal')}
        >
          Ordinals
        </button>
        <button
          className={`pb-2 px-4 ${activeTab === 'hooks' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('hooks')}
        >
          Hooks
        </button>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'plural' && <PluralizationExamples />}
      {activeTab === 'context' && <ContextExamples />}
      {activeTab === 'ordinal' && <OrdinalExamples />}
      {activeTab === 'hooks' && <HookExamples />}
    </div>
  )
}

export default I18nAdvancedExamples