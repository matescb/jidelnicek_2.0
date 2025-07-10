import React from 'react'
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  CardImage,
  CardActions 
} from './card'
import { 
  StatCard, 
  ProfileCard, 
  ProductCard, 
  MediaCard 
} from './cards'
import { Button } from './button'
import { TrendingUp, Users, ShoppingCart } from 'lucide-react'

export const CardExamples: React.FC = () => {
  return (
    <div className="space-y-8 p-4">
      {/* Basic Card Examples */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Basic Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Default Card */}
          <Card>
            <CardHeader>
              <CardTitle>Default Card</CardTitle>
              <CardDescription>Basic card with default styling</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This is the card content.</p>
            </CardContent>
          </Card>

          {/* Interactive Card */}
          <Card variant="primary" interactive="hover" elevation="elevated">
            <CardHeader>
              <CardTitle>Interactive Card</CardTitle>
              <CardDescription>Hover over me!</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This card responds to hover.</p>
            </CardContent>
          </Card>

          {/* Card with Image */}
          <Card>
            <CardImage 
              src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"
              alt="Food"
              height="h-40"
            />
            <CardHeader>
              <CardTitle>Card with Image</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Specialized Cards */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Specialized Cards</h2>
        
        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Total Sales"
            value="$12,345"
            icon={ShoppingCart}
            trend={{ value: 12.5 }}
            variant="success"
          />
          <StatCard
            title="Active Users"
            value="1,234"
            icon={Users}
            trend={{ value: -2.3 }}
            variant="primary"
          />
          <StatCard
            title="Growth Rate"
            value="23%"
            icon={TrendingUp}
            variant="warning"
          />
        </div>

        {/* Profile Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProfileCard
            name="John Doe"
            role="Senior Chef"
            email="john@example.com"
            status="online"
            variant="compact"
          />
          <ProfileCard
            name="Jane Smith"
            role="Restaurant Manager"
            email="jane@example.com"
            location="New York, USA"
            tags={["Management", "Operations"]}
            actions={{
              primary: { label: "Contact", onClick: () => {} }
            }}
          />
        </div>

        {/* Product Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ProductCard
            name="Delicious Pizza"
            image="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400"
            price={{ amount: 12.99 }}
            rating={{ value: 4.5, count: 123 }}
            variant="compact"
          />
          <ProductCard
            name="Fresh Salad"
            description="Healthy and nutritious salad with fresh vegetables"
            image="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"
            price={{ amount: 8.99, originalAmount: 10.99 }}
            category="Healthy"
            onSale
            prepTime="15 min"
            difficulty="easy"
            onAddToCart={() => {}}
          />
          <ProductCard
            name="Gourmet Burger"
            image="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400"
            price={{ amount: 14.99 }}
            rating={{ value: 4.8 }}
            featured
            inStock={false}
          />
        </div>

        {/* Media Card */}
        <MediaCard
          type="image"
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600"
          title="Culinary Photography"
          author={{ name: "Food Photographer" }}
          views={5432}
          date="2 days ago"
        />
      </section>

      {/* Card States */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Card States</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card loading>
            <CardContent>Loading content...</CardContent>
          </Card>
          <Card disabled>
            <CardContent>Disabled card</CardContent>
          </Card>
          <Card selected>
            <CardContent>Selected card</CardContent>
          </Card>
          <Card ribbon={{ text: 'New', color: 'success' }}>
            <CardContent>Card with ribbon</CardContent>
          </Card>
        </div>
      </section>

      {/* Card Variants */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Color Variants</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {(['default', 'primary', 'secondary', 'success', 'warning', 'error'] as const).map(variant => (
            <Card key={variant} variant={variant}>
              <CardContent className="text-center">
                <p className="capitalize">{variant}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}