import React from 'react'
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter,
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
import { Badge } from './badge'
import { 
  TrendingUp, 
  Users, 
  ShoppingCart, 
  DollarSign,
  Heart,
  MessageCircle,
  Share2
} from 'lucide-react'

export const CardShowcase: React.FC = () => {
  const [favoriteItems, setFavoriteItems] = React.useState<Set<string>>(new Set())

  const toggleFavorite = (id: string) => {
    setFavoriteItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-12 p-8">
      {/* Basic Card Variants */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Basic Card Variants</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Default Card</CardTitle>
              <CardDescription>This is a default card with standard styling</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Card content goes here. This card has the default variant with subtle borders and raised elevation.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>

          <Card variant="primary" interactive="hover">
            <CardHeader>
              <CardTitle>Primary Card</CardTitle>
              <CardDescription>Hover over me!</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This is a primary variant card with hover interaction.</p>
            </CardContent>
          </Card>

          <Card variant="gradient" elevation="elevated" interactive="clickable">
            <CardHeader>
              <CardTitle>Gradient Card</CardTitle>
              <CardDescription>Click me for interaction</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This card has a gradient background and elevated shadow.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Card States */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Card States</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card loading>
            <CardContent>
              <p>This content is loading...</p>
            </CardContent>
          </Card>

          <Card disabled>
            <CardHeader>
              <CardTitle>Disabled Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This card is disabled</p>
            </CardContent>
          </Card>

          <Card selected>
            <CardHeader>
              <CardTitle>Selected Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This card is selected</p>
            </CardContent>
          </Card>

          <Card ribbon={{ text: 'New', color: 'success' }}>
            <CardHeader>
              <CardTitle>Card with Ribbon</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This card has a ribbon badge</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Cards with Images */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Cards with Images</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardImage 
              src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500"
              alt="Food"
              height="h-48"
            />
            <CardHeader>
              <CardTitle>Card with Image</CardTitle>
              <CardDescription>Simple image header</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardImage 
              src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500"
              alt="Salad"
              height="h-48"
              overlay
              overlayContent={
                <div>
                  <h3 className="font-bold text-lg">Overlay Content</h3>
                  <p className="text-sm">With gradient overlay</p>
                </div>
              }
            />
            <CardContent>
              <p>Card with image overlay</p>
            </CardContent>
          </Card>

          <Card variant="secondary" withAnimation animationType="slide">
            <CardImage 
              src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500"
              alt="Pizza"
              height="h-48"
            />
            <CardHeader>
              <CardTitle>Animated Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This card slides in</p>
            </CardContent>
            <CardActions align="between">
              <Button variant="ghost" size="icon">
                <Heart className="h-4 w-4" />
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon">
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </CardActions>
          </Card>
        </div>
      </section>

      {/* Stat Cards */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Stat Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Revenue"
            value="$45,231"
            description="20.1% increase from last month"
            icon={DollarSign}
            trend={{ value: 20.1, label: "vs last month" }}
            variant="primary"
          />
          <StatCard
            title="Active Users"
            value="2,350"
            icon={Users}
            trend={{ value: -5.4 }}
            variant="secondary"
          />
          <StatCard
            title="Sales"
            value="12,234"
            description="Monthly sales target: 15,000"
            icon={ShoppingCart}
            trend={{ value: 10.5 }}
            variant="success"
          />
          <StatCard
            title="Growth"
            value="89%"
            icon={TrendingUp}
            variant="warning"
            size="sm"
          />
        </div>
      </section>

      {/* Profile Cards */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Profile Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProfileCard
            name="Jane Doe"
            role="Head Chef"
            avatar="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150"
            email="jane.doe@restaurant.com"
            status="online"
            variant="compact"
          />
          <ProfileCard
            name="John Smith"
            role="Sous Chef"
            avatar="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
            email="john.smith@restaurant.com"
            phone="+1 234 567 890"
            location="New York, USA"
            status="busy"
            tags={["Italian", "French", "Pastry"]}
            actions={{
              primary: { label: "Contact", onClick: () => {} },
              secondary: { label: "View Profile", onClick: () => {} }
            }}
          />
          <ProfileCard
            name="Emily Johnson"
            role="Pastry Chef"
            avatar="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150"
            email="emily@restaurant.com"
            website="https://emily-bakes.com"
            bio="Passionate about creating delicious desserts and teaching others the art of pastry."
            status="away"
            variant="detailed"
            tags={["Desserts", "Baking", "Chocolate"]}
          />
        </div>
      </section>

      {/* Product/Recipe Cards */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Product/Recipe Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProductCard
            name="Classic Margherita Pizza"
            image="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500"
            category="Italian"
            rating={{ value: 4.5, count: 234 }}
            prepTime="30 min"
            servings={4}
            difficulty="easy"
            variant="compact"
            isFavorite={favoriteItems.has('pizza')}
            onToggleFavorite={() => toggleFavorite('pizza')}
          />
          <ProductCard
            name="Gourmet Burger Meal"
            description="Juicy beef patty with fresh vegetables, special sauce, and crispy fries"
            image="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500"
            price={{ amount: 12.99, originalAmount: 15.99 }}
            category="American"
            rating={{ value: 4.8, count: 512 }}
            onSale
            isFavorite={favoriteItems.has('burger')}
            onToggleFavorite={() => toggleFavorite('burger')}
            onAddToCart={() => {}}
          />
          <ProductCard
            name="Fresh Garden Salad"
            description="Crisp lettuce, tomatoes, cucumbers, and our house dressing"
            image="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500"
            price={{ amount: 8.50 }}
            category="Healthy"
            rating={{ value: 4.2, count: 89 }}
            prepTime="15 min"
            servings={2}
            difficulty="easy"
            tags={["Vegetarian", "Gluten-Free", "Low-Calorie"]}
            isNew
            variant="detailed"
            isFavorite={favoriteItems.has('salad')}
            onToggleFavorite={() => toggleFavorite('salad')}
            onAddToCart={() => {}}
          />
        </div>
      </section>

      {/* Media Cards */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Media Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MediaCard
            type="image"
            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500"
            title="Food Photography Tips"
            author={{ name: "Photo Pro", avatar: "https://i.pravatar.cc/150?img=1" }}
            views={15420}
            date="2 days ago"
          />
          <MediaCard
            type="video"
            src="https://example.com/video.mp4"
            thumbnail="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500"
            title="How to Make Perfect Pasta"
            duration="12:45"
            author={{ name: "Chef Mario" }}
            views={45200}
            date="1 week ago"
            variant="horizontal"
          />
          <MediaCard
            type="video"
            src="https://example.com/video2.mp4"
            thumbnail="https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=500"
            title="Restaurant Kitchen Tour"
            description="Take a behind-the-scenes look at our state-of-the-art kitchen"
            duration="5:30"
            tags={["Kitchen", "Tour", "Behind the Scenes"]}
            variant="overlay"
            size="lg"
          />
        </div>
      </section>

      {/* Color Variants */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Color Variants</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {(['default', 'primary', 'secondary', 'success', 'warning', 'error'] as const).map((variant) => (
            <Card key={variant} variant={variant} interactive="hover">
              <CardContent className="text-center py-8">
                <Badge variant={variant} className="mb-2">{variant}</Badge>
                <p className="text-sm capitalize">{variant} Card</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Elevation & Border Variants */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Elevation & Border Variants</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card elevation="flat" border="none">
              <CardContent>
                <p className="font-semibold">Flat + No Border</p>
                <p className="text-sm text-muted-foreground">Clean and minimal</p>
              </CardContent>
            </Card>
            <Card elevation="raised" border="subtle">
              <CardContent>
                <p className="font-semibold">Raised + Subtle Border</p>
                <p className="text-sm text-muted-foreground">Default appearance</p>
              </CardContent>
            </Card>
            <Card elevation="elevated" border="prominent">
              <CardContent>
                <p className="font-semibold">Elevated + Prominent Border</p>
                <p className="text-sm text-muted-foreground">Maximum emphasis</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}