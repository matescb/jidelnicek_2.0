export default {
  auth: {
    tagline: 'Plan your meals with ease',
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    firstName: 'First Name',
    lastName: 'Last Name',
    forgotPassword: 'Forgot Password?',
    backToLogin: 'Back to Login',
    sendResetLink: 'Send Reset Link',
    resetPassword: 'Reset Password',
    newPassword: 'New Password',
    verifyEmail: 'Verify Email',
    resendVerification: 'Resend Verification Email',
    
    // Messages
    loginSuccess: 'Welcome back!',
    loginError: 'Invalid email or password',
    registerSuccess: 'Account created successfully! Please verify your email.',
    registerError: 'Failed to create account',
    logoutSuccess: 'You have been logged out',
    passwordResetSent: 'Password reset link sent to your email',
    passwordResetSuccess: 'Password has been reset successfully',
    emailVerified: 'Email verified successfully',
    emailVerificationSent: 'Verification email sent',
    loginRequired: 'Login Required',
    loginToFavorite: 'Please login to add recipes to favorites',
    loginToRate: 'Please login to rate recipes',
    
    // Validation
    emailRequired: 'Email is required',
    emailInvalid: 'Please enter a valid email',
    passwordRequired: 'Password is required',
    passwordMin: 'Password must be at least {{min}} characters',
    passwordRequirements: 'Password must contain uppercase, lowercase, number, and special character',
    passwordsMatch: 'Passwords must match',
    nameRequired: 'Name is required',
  },
  
  navigation: {
    dashboard: 'Dashboard',
    recipes: 'Recipes',
    trips: 'Trips',
    profile: 'Profile',
    settings: 'Settings',
    admin: 'Admin',
    
    // Sub-navigation
    myRecipes: 'My Recipes',
    publicRecipes: 'Public Recipes',
    createRecipe: 'Create Recipe',
    myTrips: 'My Trips',
    createTrip: 'Create Trip',
    shoppingList: 'Shopping List',
    packingList: 'Packing List',
  },
  
  breadcrumbs: {
    home: 'Home',
    dashboard: 'Dashboard',
    recipes: 'Recipes',
    trips: 'Trips',
    profile: 'Profile',
    settings: 'Settings',
    new: 'New',
    edit: 'Edit',
    details: 'Details',
  },
  
  home: {
    title: 'Welcome to Jídelníček',
    subtitle: 'Plan your meals, manage recipes, and organize trips with our comprehensive meal planning solution.',
    getStarted: 'Get Started',
    login: 'Login',
    goToDashboard: 'Go to Dashboard',
    features: {
      recipes: {
        title: 'Recipe Management',
        description: 'Create, organize, and share your favorite recipes with nutritional calculations.',
      },
      trips: {
        title: 'Trip Planning',
        description: 'Plan meals for trips with participant management and automatic scaling.',
      },
      shopping: {
        title: 'Shopping Lists',
        description: 'Generate intelligent shopping lists with automatic ingredient aggregation.',
      },
      nutrition: {
        title: 'Nutritional Analysis',
        description: 'Track calories, macros, and nutritional information for all your meals.',
      },
    },
  },
  
  recipes: {
    title: 'Recipes',
    createNew: 'Create New Recipe',
    searchPlaceholder: 'Search recipes...',
    subtitle: 'Discover and create delicious recipes',
    filters: {
      all: 'All Recipes',
      mine: 'My Recipes',
      public: 'Public',
      private: 'Private',
      favorites: 'Favorites',
    },
    
    // Recipe form
    name: 'Recipe Name',
    description: 'Description',
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    prepTime: 'Prep Time',
    cookTime: 'Cook Time',
    totalTime: 'Total Time',
    servings: 'Servings',
    difficulty: 'Difficulty',
    categories: 'Categories',
    tags: 'Tags',
    isPublic: 'Make recipe public',
    basicInfo: 'Basic Information',
    images: 'Images',
    uploadImages: 'Click to upload images',
    imageRequirements: 'Max 10 images, 5MB each (JPEG, PNG, WebP)',
    maxImages: 'Maximum 10 images allowed',
    existingImages: 'Current Images',
    addMoreImages: 'Add More Images',
    maxImagesError: 'Maximum 10 images allowed',
    primaryImage: 'Primary',
    ingredientName: 'Ingredient name',
    quantity: 'Quantity',
    recipes: 'recipes',
    
    // Difficulty levels
    difficultyLevels: {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
    },
    
    // Units
    units: {
      g: 'grams',
      kg: 'kilograms',
      ml: 'milliliters',
      l: 'liters',
      cup: 'cup',
      tbsp: 'tablespoon',
      tsp: 'teaspoon',
      piece: 'piece',
    },
    
    // Messages
    created: 'Recipe created successfully',
    updated: 'Recipe updated successfully',
    deleted: 'Recipe deleted',
    duplicated: 'Recipe duplicated',
    noRecipes: 'No recipes found',
    noRecipesFound: 'No recipes match your filters',
    allCategories: 'All Categories',
    allDifficulties: 'All Difficulties',
    linkCopied: 'Recipe link copied to clipboard',
    ratingSubmitted: 'Your rating has been submitted',
    
    // Actions
    addIngredient: 'Add Ingredient',
    addInstruction: 'Add Instruction',
    duplicate: 'Duplicate',
    share: 'Share',
    print: 'Print',
    favorite: 'Add to favorites',
    unfavorite: 'Remove from favorites',
    myRecipe: 'My Recipe',
    addToTrip: 'Add to Trip',
    addToShoppingList: 'Add to Shopping List',
    scaledFrom: 'Scaled from {{original}} servings',
    createdBy: 'Created by',
    ratings: 'ratings',
  },
  
  trips: {
    title: 'Trips',
    createNew: 'Create New Trip',
    searchPlaceholder: 'Search trips...',
    
    // Trip form
    name: 'Trip Name',
    description: 'Description',
    startDate: 'Start Date',
    endDate: 'End Date',
    participantCount: 'Participants',
    meals: 'Meals',
    
    // Participants
    addParticipant: 'Add Participant',
    participantName: 'Name',
    participantEmail: 'Email (optional)',
    arrivalDate: 'Arrival Date',
    departureDate: 'Departure Date',
    mealCoefficients: 'Meal Coefficients',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    
    // Meals
    assignMeal: 'Assign Meal',
    mealSlot: 'Meal Slot',
    selectRecipe: 'Select Recipe',
    portions: 'Portions',
    availableRecipes: 'Available Recipes',
    dragRecipeHere: 'Drag a recipe here',
    dayNumber: 'Day {{number}}',
    copyDay: 'Copy day',
    clearDay: 'Clear day',
    dragInstructions: 'Drag recipes from the left to assign them to meal slots',
    copyFirstWeek: 'Copy first week',
    copiedDayInfo: 'Day {{day}} copied - click on another day to paste',
    tripSummary: 'Trip Summary',
    totalMeals: 'Total Meals',
    uniqueRecipes: 'Unique Recipes',
    avgDailyCalories: 'Avg Daily Calories',
    participantsSummary: 'Participants',
    
    // Meal types
    mealTypes: {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack: 'Snack',
    },
    
    // Messages
    created: 'Trip created successfully',
    updated: 'Trip updated successfully',
    deleted: 'Trip deleted',
    noTrips: 'No trips found',
    participantLimit: 'Maximum {{max}} participants allowed',
    mealAssigned: 'Meal assigned successfully',
    mealAssignError: 'Failed to assign meal',
    mealRemoved: 'Meal removed successfully',
    mealRemoveError: 'Failed to remove meal',
    mealMovingNotSupported: 'Moving meals between slots is not yet supported',
    dayCopied: 'Day copied to clipboard',
    dayPasted: 'Meals pasted successfully',
    dayPasteError: 'Failed to paste meals',
    confirmClearDay: 'Are you sure you want to clear all meals from this day?',
    dayCleared: 'Day cleared successfully',
    dayClearError: 'Failed to clear day',
    confirmCopyWeek: 'Copy the first week\'s meals to all remaining weeks?',
    weekCopied: 'First week copied to all weeks',
    weekCopyError: 'Failed to copy week',
  },
  
  shoppingList: {
    title: 'Shopping List',
    generate: 'Generate List',
    regenerate: 'Regenerate',
    
    // Categories
    categories: {
      produce: 'Produce',
      dairy: 'Dairy',
      meat: 'Meat',
      bakery: 'Bakery',
      pantry: 'Pantry',
      frozen: 'Frozen',
      other: 'Other',
    },
    
    // Actions
    addCustomItem: 'Add Custom Item',
    markPurchased: 'Mark as Purchased',
    clearPurchased: 'Clear Purchased',
    export: 'Export',
    print: 'Print',
  },
  
  nutrition: {
    title: 'Nutritional Information',
    perServing: 'Per Serving',
    total: 'Total',
    
    // Nutrients
    calories: 'Calories',
    protein: 'Protein',
    carbs: 'Carbohydrates',
    fat: 'Fat',
    fiber: 'Fiber',
    sodium: 'Sodium',
    
    // Units
    kcal: 'kcal',
    g: 'g',
    mg: 'mg',
  },
  
  settings: {
    title: 'Settings',
    
    // Sections
    account: 'Account',
    preferences: 'Preferences',
    notifications: 'Notifications',
    privacy: 'Privacy',
    
    // Preferences
    language: 'Language',
    theme: 'Theme',
    defaultServings: 'Default Servings',
    units: 'Measurement Units',
    
    // Themes
    themes: {
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    
    // Units
    unitSystems: {
      metric: 'Metric',
      imperial: 'Imperial',
    },
    
    // Actions
    changePassword: 'Change Password',
    deleteAccount: 'Delete Account',
    exportData: 'Export My Data',
  },
  
  notFound: {
    title: 'Page Not Found',
    message: 'The page you are looking for doesn\'t exist or has been moved.',
    backHome: 'Go Back Home',
  },
  
  errors: {
    title: 'Something went wrong',
    generic: 'An unexpected error occurred',
    network: 'Network error. Please check your connection.',
    unauthorized: 'You need to login to access this page',
    forbidden: 'You don\'t have permission to access this resource',
    notFound: 'Resource not found',
    validation: 'Please check your input',
    server: 'Server error. Please try again later.',
    
    // Form errors
    formErrors: 'Form Errors',
    fieldErrors: 'Field Errors',
    validationError: 'Validation Error',
    validationErrors: 'Validation Errors',
    clickToExpand: 'Click to view {{count}} errors',
    formRenderError: 'Unable to display form',
    unknownError: 'Unknown error',
  },
  
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    update: 'Update',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Info',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    close: 'Close',
    view: 'View',
    download: 'Download',
    upload: 'Upload',
    refresh: 'Refresh',
    reset: 'Reset',
    clear: 'Clear',
    select: 'Select',
    selectAll: 'Select All',
    none: 'None',
    all: 'All',
    min: 'Min',
    max: 'Max',
    minutes: 'min',
    saving: 'Saving...',
    loadMore: 'Load More',
    clearFilters: 'Clear Filters',
    anonymous: 'Anonymous',
    step: 'Step',
    actions: 'Actions',
    noData: 'No data available',
    ascending: 'Ascending',
    descending: 'Descending',
    dismiss: 'Dismiss',
    expand: 'Expand',
    collapse: 'Collapse',
    continue: 'Continue',
    retry: 'Retry',
    markComplete: 'Mark as Complete',
    
    // Time
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    
    // Status
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    completed: 'Completed',
    
    // Pagination
    page: 'Page',
    of: 'of',
    items: 'items',
    showing: 'Showing',
    to: 'to',
    
    // Confirmation
    deleteConfirm: 'Are you sure you want to delete this {{item}}?',
    unsavedChanges: 'You have unsaved changes. Are you sure you want to leave?',
  },
  
  // Date and time
  dateTime: {
    formats: {
      date: 'MM/DD/YYYY',
      time: 'HH:mm',
      dateTime: 'MM/DD/YYYY HH:mm',
    },
    days: {
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
    },
    months: {
      january: 'January',
      february: 'February',
      march: 'March',
      april: 'April',
      may: 'May',
      june: 'June',
      july: 'July',
      august: 'August',
      september: 'September',
      october: 'October',
      november: 'November',
      december: 'December',
    },
  },
  
  // Form submission feedback
  form: {
    submitting: 'Submitting...',
    submitSuccess: 'Successfully submitted',
    submitError: 'Submission failed',
    progress: 'Progress: {{value}}%',
    step: 'Step',
    syncing: 'Syncing...',
    synced: 'Synced',
    syncError: 'Sync failed',
    retryAttempt: 'Retry attempt {{current}} of {{max}}',
    maxRetriesReached: 'Maximum retry attempts reached',
    elapsed: 'Elapsed: {{time}}',
    remaining: 'Remaining: {{time}}',
    seconds_one: '{{count}} second',
    seconds_other: '{{count}} seconds',
    minutesSeconds: '{{minutes}}m {{seconds}}s',
  },
  
  // Examples
  examples: {
    formSubmissionPatterns: 'Form Submission Feedback Patterns',
    basicSubmit: 'Basic Submit Button',
    multiStepForm: 'Multi-Step Form with Progress',
    submissionFeedback: 'Submission Feedback Messages',
    progressTracking: 'Progress Tracking Example',
    optimisticUpdate: 'Optimistic Update Pattern',
    formSkeleton: 'Form Loading Skeleton',
  },
}