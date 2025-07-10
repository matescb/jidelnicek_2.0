export default {
  auth: {
    tagline: 'Plánujte svá jídla snadno',
    login: 'Přihlásit',
    register: 'Registrovat',
    logout: 'Odhlásit',
    email: 'Email',
    password: 'Heslo',
    confirmPassword: 'Potvrdit heslo',
    firstName: 'Jméno',
    lastName: 'Příjmení',
    forgotPassword: 'Zapomenuté heslo?',
    backToLogin: 'Zpět na přihlášení',
    sendResetLink: 'Odeslat odkaz pro obnovení',
    resetPassword: 'Obnovit heslo',
    newPassword: 'Nové heslo',
    verifyEmail: 'Ověřit email',
    resendVerification: 'Znovu odeslat ověřovací email',
    
    // Messages
    loginSuccess: 'Vítejte zpět!',
    loginError: 'Neplatný email nebo heslo',
    registerSuccess: 'Účet byl úspěšně vytvořen! Prosím ověřte svůj email.',
    registerError: 'Nepodařilo se vytvořit účet',
    logoutSuccess: 'Byli jste odhlášeni',
    passwordResetSent: 'Odkaz pro obnovení hesla byl odeslán na váš email',
    passwordResetSuccess: 'Heslo bylo úspěšně obnoveno',
    emailVerified: 'Email byl úspěšně ověřen',
    emailVerificationSent: 'Ověřovací email byl odeslán',
    
    // Validation
    emailRequired: 'Email je povinný',
    emailInvalid: 'Zadejte prosím platný email',
    passwordRequired: 'Heslo je povinné',
    passwordMin: 'Heslo musí mít alespoň {{min}} znaků',
    passwordRequirements: 'Heslo musí obsahovat velké písmeno, malé písmeno, číslo a speciální znak',
    passwordsMatch: 'Hesla se musí shodovat',
    nameRequired: 'Jméno je povinné',
  },
  navigation: {
    dashboard: 'Přehled',
    recipes: 'Recepty',
    trips: 'Výlety',
    profile: 'Profil',
    settings: 'Nastavení',
    admin: 'Administrace',
    
    // Sub-navigation
    myRecipes: 'Moje recepty',
    publicRecipes: 'Veřejné recepty',
    createRecipe: 'Vytvořit recept',
    myTrips: 'Moje výlety',
    createTrip: 'Vytvořit výlet',
    shoppingList: 'Nákupní seznam',
    packingList: 'Seznam na balení',
  },
  breadcrumbs: {
    home: 'Domů',
    dashboard: 'Přehled',
    recipes: 'Recepty',
    trips: 'Výlety',
    profile: 'Profil',
    settings: 'Nastavení',
    new: 'Nový',
    edit: 'Upravit',
    details: 'Detail',
  },
  home: {
    title: 'Vítejte v Jídelníčku',
    subtitle: 'Plánujte svá jídla, spravujte recepty a organizujte výlety s naším komplexním řešením pro plánování jídel.',
    getStarted: 'Začít',
    login: 'Přihlásit',
    goToDashboard: 'Přejít na přehled',
    features: {
      recipes: {
        title: 'Správa receptů',
        description: 'Vytvářejte, organizujte a sdílejte své oblíbené recepty s výpočty výživových hodnot.',
      },
      trips: {
        title: 'Plánování výletů',
        description: 'Plánujte jídla pro výlety se správou účastníků a automatickým škálováním.',
      },
      shopping: {
        title: 'Nákupní seznamy',
        description: 'Generujte inteligentní nákupní seznamy s automatickou agregací ingrediencí.',
      },
      nutrition: {
        title: 'Nutriční analýza',
        description: 'Sledujte kalorie, makroživiny a nutriční informace pro všechna vaše jídla.',
      },
    },
  },
  notFound: {
    title: 'Stránka nenalezena',
    message: 'Stránka, kterou hledáte, neexistuje nebo byla přesunuta.',
    backHome: 'Zpět domů',
  },
  recipes: {
    title: 'Recepty',
    createNew: 'Vytvořit nový recept',
    searchPlaceholder: 'Hledat recepty...',
    filters: {
      all: 'Všechny recepty',
      mine: 'Moje recepty',
      public: 'Veřejné',
      private: 'Soukromé',
      favorites: 'Oblíbené',
    },
    
    // Recipe form
    name: 'Název receptu',
    description: 'Popis',
    ingredients: 'Ingredience',
    instructions: 'Postup',
    prepTime: 'Čas přípravy',
    cookTime: 'Čas vaření',
    totalTime: 'Celkový čas',
    servings: 'Porce',
    difficulty: 'Obtížnost',
    categories: 'Kategorie',
    tags: 'Štítky',
    isPublic: 'Zveřejnit recept',
    
    // Difficulty levels
    difficultyLevels: {
      easy: 'Snadný',
      medium: 'Střední',
      hard: 'Obtížný',
    },
    
    // Units
    units: {
      g: 'gramů',
      kg: 'kilogramů',
      ml: 'mililitrů',
      l: 'litrů',
      cup: 'hrnek',
      tbsp: 'lžíce',
      tsp: 'lžička',
      piece: 'kus',
    },
    
    // Messages
    created: 'Recept byl úspěšně vytvořen',
    updated: 'Recept byl úspěšně aktualizován',
    deleted: 'Recept byl smazán',
    duplicated: 'Recept byl duplikován',
    noRecipes: 'Nebyly nalezeny žádné recepty',
    noRecipesFound: 'Žádné recepty neodpovídají vašim filtrům',
    allCategories: 'Všechny kategorie',
    allDifficulties: 'Všechny obtížnosti',
    
    // Actions
    addIngredient: 'Přidat ingredienci',
    addInstruction: 'Přidat krok',
    duplicate: 'Duplikovat',
    share: 'Sdílet',
    print: 'Tisk',
    favorite: 'Přidat do oblíbených',
    unfavorite: 'Odebrat z oblíbených',
    myRecipe: 'Můj recept',
  },
  
  trips: {
    title: 'Výlety',
    createNew: 'Vytvořit nový výlet',
    searchPlaceholder: 'Hledat výlety...',
    
    // Trip form
    name: 'Název výletu',
    description: 'Popis',
    startDate: 'Datum začátku',
    endDate: 'Datum konce',
    participantCount: 'Účastníci',
    meals: 'Jídla',
    
    // Participants
    addParticipant: 'Přidat účastníka',
    participantName: 'Jméno',
    participantEmail: 'Email (nepovinný)',
    arrivalDate: 'Datum příjezdu',
    departureDate: 'Datum odjezdu',
    mealCoefficients: 'Koeficienty jídel',
    breakfast: 'Snídaně',
    lunch: 'Oběd',
    dinner: 'Večeře',
    
    // Meals
    assignMeal: 'Přiřadit jídlo',
    mealSlot: 'Čas jídla',
    selectRecipe: 'Vybrat recept',
    portions: 'Porce',
    availableRecipes: 'Dostupné recepty',
    dragRecipeHere: 'Přetáhněte recept sem',
    dayNumber: 'Den {{number}}',
    copyDay: 'Kopírovat den',
    clearDay: 'Vymazat den',
    dragInstructions: 'Přetáhněte recepty zleva a přiřaďte je k časům jídel',
    copyFirstWeek: 'Kopírovat první týden',
    copiedDayInfo: 'Den {{day}} zkopírován - klikněte na jiný den pro vložení',
    tripSummary: 'Shrnutí výletu',
    totalMeals: 'Celkem jídel',
    uniqueRecipes: 'Unikátních receptů',
    avgDailyCalories: 'Průměr kalorií/den',
    participantsSummary: 'Účastníci',
    
    // Meal types
    mealTypes: {
      breakfast: 'Snídaně',
      lunch: 'Oběd',
      dinner: 'Večeře',
      snack: 'Svačina',
    },
    
    // Messages
    created: 'Výlet byl úspěšně vytvořen',
    updated: 'Výlet byl úspěšně aktualizován',
    deleted: 'Výlet byl smazán',
    noTrips: 'Nebyly nalezeny žádné výlety',
    participantLimit: 'Maximálně {{max}} účastníků povoleno',
    mealAssigned: 'Jídlo bylo úspěšně přiřazeno',
    mealAssignError: 'Nepodařilo se přiřadit jídlo',
    mealRemoved: 'Jídlo bylo úspěšně odebráno',
    mealRemoveError: 'Nepodařilo se odebrat jídlo',
    mealMovingNotSupported: 'Přesouvání jídel mezi sloty zatím není podporováno',
    dayCopied: 'Den zkopírován do schránky',
    dayPasted: 'Jídla byla úspěšně vložena',
    dayPasteError: 'Nepodařilo se vložit jídla',
    confirmClearDay: 'Opravdu chcete vymazat všechna jídla z tohoto dne?',
    dayCleared: 'Den byl úspěšně vymazán',
    dayClearError: 'Nepodařilo se vymazat den',
    confirmCopyWeek: 'Kopírovat jídla z prvního týdne do všech zbývajících týdnů?',
    weekCopied: 'První týden byl zkopírován do všech týdnů',
    weekCopyError: 'Nepodařilo se zkopírovat týden',
  },
  
  shoppingList: {
    title: 'Nákupní seznam',
    generate: 'Vygenerovat seznam',
    regenerate: 'Znovu vygenerovat',
    
    // Categories
    categories: {
      produce: 'Ovoce a zelenina',
      dairy: 'Mléčné výrobky',
      meat: 'Maso',
      bakery: 'Pekařství',
      pantry: 'Spíž',
      frozen: 'Mražené',
      other: 'Ostatní',
    },
    
    // Actions
    addCustomItem: 'Přidat vlastní položku',
    markPurchased: 'Označit jako nakoupeno',
    clearPurchased: 'Vymazat nakoupené',
    export: 'Exportovat',
    print: 'Tisk',
  },
  
  nutrition: {
    title: 'Nutriční informace',
    perServing: 'Na porci',
    total: 'Celkem',
    
    // Nutrients
    calories: 'Kalorie',
    protein: 'Bílkoviny',
    carbs: 'Sacharidy',
    fat: 'Tuky',
    fiber: 'Vláknina',
    sodium: 'Sodík',
    
    // Units
    kcal: 'kcal',
    g: 'g',
    mg: 'mg',
  },
  
  settings: {
    title: 'Nastavení',
    
    // Sections
    account: 'Účet',
    preferences: 'Předvolby',
    notifications: 'Oznámení',
    privacy: 'Soukromí',
    
    // Preferences
    language: 'Jazyk',
    theme: 'Téma',
    defaultServings: 'Výchozí počet porcí',
    units: 'Jednotky měření',
    
    // Themes
    themes: {
      light: 'Světlé',
      dark: 'Tmavé',
      system: 'Systém',
    },
    
    // Units
    unitSystems: {
      metric: 'Metrické',
      imperial: 'Imperiální',
    },
    
    // Actions
    changePassword: 'Změnit heslo',
    deleteAccount: 'Smazat účet',
    exportData: 'Exportovat moje data',
  },
  
  errors: {
    title: 'Něco se pokazilo',
    generic: 'Nastala neočekávaná chyba',
    network: 'Chyba sítě. Zkontrolujte prosím své připojení.',
    unauthorized: 'Pro přístup k této stránce se musíte přihlásit',
    forbidden: 'Nemáte oprávnění k přístupu k tomuto zdroji',
    notFound: 'Zdroj nebyl nalezen',
    validation: 'Zkontrolujte prosím zadané údaje',
    server: 'Chyba serveru. Zkuste to prosím později.',
  },
  
  common: {
    save: 'Uložit',
    cancel: 'Zrušit',
    delete: 'Smazat',
    edit: 'Upravit',
    create: 'Vytvořit',
    update: 'Aktualizovat',
    search: 'Hledat',
    filter: 'Filtrovat',
    sort: 'Seřadit',
    loading: 'Načítání...',
    error: 'Chyba',
    success: 'Úspěch',
    warning: 'Varování',
    info: 'Info',
    confirm: 'Potvrdit',
    back: 'Zpět',
    next: 'Další',
    previous: 'Předchozí',
    yes: 'Ano',
    no: 'Ne',
    ok: 'OK',
    close: 'Zavřít',
    view: 'Zobrazit',
    download: 'Stáhnout',
    upload: 'Nahrát',
    refresh: 'Obnovit',
    reset: 'Resetovat',
    clear: 'Vymazat',
    select: 'Vybrat',
    selectAll: 'Vybrat vše',
    none: 'Žádný',
    all: 'Vše',
    
    // Time
    today: 'Dnes',
    yesterday: 'Včera',
    tomorrow: 'Zítra',
    week: 'Týden',
    month: 'Měsíc',
    year: 'Rok',
    
    // Status
    active: 'Aktivní',
    inactive: 'Neaktivní',
    pending: 'Čekající',
    completed: 'Dokončeno',
    
    // Pagination
    page: 'Stránka',
    of: 'z',
    items: 'položek',
    showing: 'Zobrazeno',
    to: 'do',
    
    // Confirmation
    deleteConfirm: 'Opravdu chcete smazat tuto {{item}}?',
    unsavedChanges: 'Máte neuložené změny. Opravdu chcete odejít?',
  },
  
  // Date and time
  dateTime: {
    formats: {
      date: 'DD.MM.YYYY',
      time: 'HH:mm',
      dateTime: 'DD.MM.YYYY HH:mm',
    },
    days: {
      monday: 'Pondělí',
      tuesday: 'Úterý',
      wednesday: 'Středa',
      thursday: 'Čtvrtek',
      friday: 'Pátek',
      saturday: 'Sobota',
      sunday: 'Neděle',
    },
    months: {
      january: 'Leden',
      february: 'Únor',
      march: 'Březen',
      april: 'Duben',
      may: 'Květen',
      june: 'Červen',
      july: 'Červenec',
      august: 'Srpen',
      september: 'Září',
      october: 'Říjen',
      november: 'Listopad',
      december: 'Prosinec',
    },
  },
}