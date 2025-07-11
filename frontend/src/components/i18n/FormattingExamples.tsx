import React from 'react'
import { 
  Formatted,
  useNumberFormat,
  useCurrencyFormat,
  useDateFormat,
  useRelativeTime,
  useListFormat,
  useFormatting,
} from '../../i18n/formatting'

// Example component demonstrating all formatting features
export const FormattingExamples: React.FC = () => {
  // Individual hooks
  const numberFormat = useNumberFormat()
  const currencyFormat = useCurrencyFormat()
  const dateFormat = useDateFormat()
  const relativeTime = useRelativeTime()
  const listFormat = useListFormat()
  
  // Combined hook
  const formatting = useFormatting()
  
  // Sample data
  const sampleNumber = 1234567.89
  const samplePrice = 299.99
  const sampleDate = new Date()
  const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
  const sampleList = ['Apples', 'Bananas', 'Oranges']
  const cookingTime = 75 // minutes
  const fileSize = 1024 * 1024 * 5.5 // 5.5 MB
  
  return (
    <div className="space-y-8 p-6">
      <section>
        <h2 className="text-2xl font-bold mb-4">Number Formatting</h2>
        <div className="space-y-2">
          <div>
            Standard: <Formatted.Number value={sampleNumber} />
          </div>
          <div>
            Compact: <Formatted.Number value={sampleNumber} compact />
          </div>
          <div>
            With decimals: <Formatted.Number value={sampleNumber} decimals={{ min: 2, max: 2 }} />
          </div>
          <div>
            Ordinal: <Formatted.Number value={21} ordinal />
          </div>
          <div>
            Bytes: <Formatted.Number value={fileSize} bytes />
          </div>
          <div>
            Using hook: {numberFormat.format(sampleNumber, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Currency Formatting</h2>
        <div className="space-y-2">
          <div>
            Default currency: <Formatted.Currency value={samplePrice} />
          </div>
          <div>
            USD: <Formatted.Currency value={samplePrice} currency="USD" />
          </div>
          <div>
            No decimals: <Formatted.Currency 
              value={samplePrice} 
              options={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }} 
            />
          </div>
          <div>
            Percent: <Formatted.Percent value={0.1523} />
          </div>
          <div>
            Using hook: {currencyFormat.format(samplePrice, 'GBP')}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Date & Time Formatting</h2>
        <div className="space-y-2">
          <div>
            Date: <Formatted.Date value={sampleDate} />
          </div>
          <div>
            Custom format: <Formatted.Date value={sampleDate} format="yyyy-MM-dd" />
          </div>
          <div>
            DateTime: <Formatted.DateTime value={sampleDate} />
          </div>
          <div>
            Long DateTime: <Formatted.DateTime 
              value={sampleDate} 
              dateStyle="full" 
              timeStyle="medium" 
            />
          </div>
          <div>
            Time only: <Formatted.Time value={sampleDate} />
          </div>
          <div>
            Duration: <Formatted.Duration minutes={cookingTime} />
          </div>
          <div>
            Using hook: {dateFormat.format(sampleDate, 'EEEE, MMMM do')}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Relative Time Formatting</h2>
        <div className="space-y-2">
          <div>
            Distance: <Formatted.RelativeTime value={pastDate} />
          </div>
          <div>
            Relative: <Formatted.RelativeTime value={pastDate} style="relative" />
          </div>
          <div>
            Future date: <Formatted.RelativeTime 
              value={new Date(Date.now() + 24 * 60 * 60 * 1000)} 
            />
          </div>
          <div>
            Using hook: {relativeTime.format(pastDate)}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">List Formatting</h2>
        <div className="space-y-2">
          <div>
            Default: <Formatted.List items={sampleList} />
          </div>
          <div>
            Disjunction: <Formatted.List 
              items={sampleList} 
              options={{ type: 'disjunction' }} 
            />
          </div>
          <div>
            Unit: <Formatted.List 
              items={sampleList} 
              options={{ type: 'unit', style: 'narrow' }} 
            />
          </div>
          <div>
            Using hook: {listFormat.format(['First', 'Second', 'Third', 'Fourth'])}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Combined Formatting Hook</h2>
        <div className="space-y-2">
          <div>
            Number: {formatting.number.format(9876.54)}
          </div>
          <div>
            Currency: {formatting.currency.format(49.99)}
          </div>
          <div>
            Date: {formatting.date.format(sampleDate)}
          </div>
          <div>
            Relative: {formatting.relativeTime.format(pastDate)}
          </div>
          <div>
            List: {formatting.list.format(['One', 'Two', 'Three'])}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Edge Cases & Error Handling</h2>
        <div className="space-y-2">
          <div>
            Invalid date: <Formatted.Date value="invalid-date" />
          </div>
          <div>
            Empty list: <Formatted.List items={[]} />
          </div>
          <div>
            Zero bytes: <Formatted.Number value={0} bytes />
          </div>
          <div>
            Negative number: <Formatted.Currency value={-99.99} />
          </div>
        </div>
      </section>
    </div>
  )
}

// Example of using formatting in a practical component
interface RecipeCardProps {
  title: string
  price: number
  cookingTime: number
  createdAt: Date
  ingredients: string[]
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  title,
  price,
  cookingTime,
  createdAt,
  ingredients,
}) => {
  return (
    <div className="border rounded-lg p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      
      <div className="space-y-1 text-sm text-gray-600">
        <div>
          Price: <Formatted.Currency value={price} className="font-medium text-green-600" />
        </div>
        
        <div>
          Cooking time: <Formatted.Duration minutes={cookingTime} />
        </div>
        
        <div>
          Added: <Formatted.RelativeTime value={createdAt} />
        </div>
        
        <div>
          Ingredients: <Formatted.List items={ingredients.slice(0, 3)} />
          {ingredients.length > 3 && (
            <span className="text-gray-500"> +{ingredients.length - 3} more</span>
          )}
        </div>
      </div>
    </div>
  )
}