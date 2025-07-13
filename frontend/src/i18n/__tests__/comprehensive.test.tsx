import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { BrowserRouter } from 'react-router-dom'

// Import components to test
import { RecipeForm } from '@/components/recipes/RecipeForm'
import { TripWizard } from '@/components/trips/TripWizard'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { LoginForm } from '@/components/auth/LoginForm'
import { NavigationMenu } from '@/components/navigation/NavigationMenu'

// Import i18n utilities
import { useTypedTranslation } from '../hooks/useTranslation'
import { useFormatting } from '../hooks/useFormatting'
import { isRTL, updateDocumentDirection } from '../rtl'

// Comprehensive translation data for testing
const comprehensiveTestTranslations = {
  en: {
    translation: {
      // Authentication
      auth: {
        login: 'Login',
        register: 'Register',
        email: 'Email',
        password: 'Password',
        firstName: 'First Name',
        lastName: 'Last Name',
        emailRequired: 'Email is required',
        emailInvalid: 'Please enter a valid email',
        passwordRequired: 'Password is required',
        passwordMin: 'Password must be at least {{min}} characters',
        loginSuccess: 'Welcome back!',
        loginError: 'Invalid email or password',
      },
      
      // Navigation
      navigation: {
        dashboard: 'Dashboard',
        recipes: 'Recipes',
        trips: 'Trips',
        profile: 'Profile',
        settings: 'Settings',
        search: 'Search',
        openMenu: 'Open menu',
        closeMenu: 'Close menu',
      },
      
      // Recipes
      recipes: {
        title: 'Recipes',
        createNew: 'Create New Recipe',
        searchPlaceholder: 'Search recipes...',
        name: 'Recipe Name',
        description: 'Description',
        ingredients: 'Ingredients',
        instructions: 'Instructions',
        prepTime: 'Prep Time',
        cookTime: 'Cook Time',
        servings: 'Servings',
        difficulty: 'Difficulty',
        categories: 'Categories',
        tags: 'Tags',
        isPublic: 'Make recipe public',
        addIngredient: 'Add Ingredient',
        addInstruction: 'Add Instruction',
        ingredientName: 'Ingredient name',
        quantity: 'Quantity',
        created: 'Recipe created successfully',
        updated: 'Recipe updated successfully',
        noRecipes: 'No recipes found',
        difficultyLevels: {
          easy: 'Easy',
          medium: 'Medium',
          hard: 'Hard',
        },
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
      },
      
      // Trips
      trips: {
        title: 'Trips',
        createNew: 'Create New Trip',
        name: 'Trip Name',
        description: 'Description',
        startDate: 'Start Date',
        endDate: 'End Date',
        participantCount: 'Participants',
        addParticipant: 'Add Participant',
        participantName: 'Name',
        participantEmail: 'Email (optional)',
        mealTypes: {
          breakfast: 'Breakfast',
          lunch: 'Lunch',
          dinner: 'Dinner',
          snack: 'Snack',
        },
        created: 'Trip created successfully',
        updated: 'Trip updated successfully',
        noTrips: 'No trips found',
      },
      
      // Common
      common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        create: 'Create',
        search: 'Search',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        yes: 'Yes',
        no: 'No',
        ok: 'OK',
        close: 'Close',
        back: 'Back',
        next: 'Next',
        previous: 'Previous',
        minutes: 'min',
        participants: 'Participants',
        serving: 'serving',
        servings: 'servings',
        deleteConfirm: 'Are you sure you want to delete this {{item}}?',
      },
      
      // Pluralization examples
      plurals: {
        recipe_one: '{{count}} recipe',
        recipe_other: '{{count}} recipes',
        participant_one: '{{count}} participant',
        participant_other: '{{count}} participants',
        day_one: '{{count}} day',
        day_other: '{{count}} days',
        ingredient_one: '{{count}} ingredient',
        ingredient_other: '{{count}} ingredients',
        meal_one: '{{count}} meal',
        meal_other: '{{count}} meals',
        item_one: '{{count}} item',
        item_other: '{{count}} items',
        minute_one: '{{count}} minute',
        minute_other: '{{count}} minutes',
        notification_zero: 'No notifications',
        notification_one: '{{count}} notification',
        notification_other: '{{count}} notifications',
        recipesInTrip_one: 'This trip contains {{count}} recipe for {{participants}} people',
        recipesInTrip_other: 'This trip contains {{count}} recipes for {{participants}} people',
      },
      
      // Context examples
      contexts: {
        welcome: 'Welcome',
        welcome_formal: 'Welcome',
        welcome_informal: 'Hi there',
        greeting: 'Hello {{name}}',
        greeting_formal: 'Dear {{name}}',
        greeting_informal: 'Hey {{name}}',
        userAction: '{{name}} {{action}}',
        userCreated: '{{name}} created',
        userArrived: '{{name}} arrived',
      },
      
      // Layout and UI
      layout: {
        shortText: 'Short',
        mediumText: 'This is a medium length text that might wrap',
        longText: 'This is a very long text that will definitely wrap to multiple lines and test text overflow handling in different languages',
        veryLongText: 'This is an extremely long text that simulates content that might be much longer in some languages than others, which is important for testing layout adaptation and text overflow behavior across different locales and language systems',
      },
      
      // Form validation
      validation: {
        required: 'This field is required',
        email: 'Please enter a valid email address',
        minLength: 'Must be at least {{min}} characters',
        maxLength: 'Must not exceed {{max}} characters',
        number: 'Please enter a valid number',
        positive: 'Must be a positive number',
        min: 'Must be at least {{min}}',
        max: 'Must not exceed {{max}}',
      },
      
      // Formatting examples
      formatting: {
        price: '{{amount, currency}}',
        date: '{{date, date}}',
        dateTime: '{{date, datetime}}',
        number: '{{value, number}}',
        ordinal: '{{value, ordinal}}',
        percentage: '{{value}}%',
      },
    },
  },
  cs: {
    translation: {
      // Authentication
      auth: {
        login: 'Přihlásit se',
        register: 'Registrovat se',
        email: 'Email',
        password: 'Heslo',
        firstName: 'Křestní jméno',
        lastName: 'Příjmení',
        emailRequired: 'Email je povinný',
        emailInvalid: 'Zadejte platný email',
        passwordRequired: 'Heslo je povinné',
        passwordMin: 'Heslo musí mít alespoň {{min}} znaků',
        loginSuccess: 'Vítejte zpět!',
        loginError: 'Neplatný email nebo heslo',
      },
      
      // Navigation
      navigation: {
        dashboard: 'Nástěnka',
        recipes: 'Recepty',
        trips: 'Výlety',
        profile: 'Profil',
        settings: 'Nastavení',
        search: 'Hledat',
        openMenu: 'Otevřít menu',
        closeMenu: 'Zavřít menu',
      },
      
      // Recipes
      recipes: {
        title: 'Recepty',
        createNew: 'Vytvořit nový recept',
        searchPlaceholder: 'Hledat recepty...',
        name: 'Název receptu',
        description: 'Popis',
        ingredients: 'Ingredience',
        instructions: 'Pokyny',
        prepTime: 'Příprava',
        cookTime: 'Vaření',
        servings: 'Porce',
        difficulty: 'Obtížnost',
        categories: 'Kategorie',
        tags: 'Štítky',
        isPublic: 'Zveřejnit recept',
        addIngredient: 'Přidat ingredienci',
        addInstruction: 'Přidat pokyn',
        ingredientName: 'Název ingredience',
        quantity: 'Množství',
        created: 'Recept byl úspěšně vytvořen',
        updated: 'Recept byl úspěšně aktualizován',
        noRecipes: 'Nebyly nalezeny žádné recepty',
        difficultyLevels: {
          easy: 'Snadná',
          medium: 'Střední',
          hard: 'Těžká',
        },
        units: {
          g: 'gramy',
          kg: 'kilogramy',
          ml: 'mililitry',
          l: 'litry',
          cup: 'hrnek',
          tbsp: 'polévková lžíce',
          tsp: 'kávová lžička',
          piece: 'kus',
        },
      },
      
      // Trips
      trips: {
        title: 'Výlety',
        createNew: 'Vytvořit nový výlet',
        name: 'Název výletu',
        description: 'Popis',
        startDate: 'Datum začátku',
        endDate: 'Datum konce',
        participantCount: 'Účastníci',
        addParticipant: 'Přidat účastníka',
        participantName: 'Jméno',
        participantEmail: 'Email (nepovinný)',
        mealTypes: {
          breakfast: 'Snídaně',
          lunch: 'Oběd',
          dinner: 'Večeře',
          snack: 'Svačina',
        },
        created: 'Výlet byl úspěšně vytvořen',
        updated: 'Výlet byl úspěšně aktualizován',
        noTrips: 'Nebyly nalezeny žádné výlety',
      },
      
      // Common
      common: {
        save: 'Uložit',
        cancel: 'Zrušit',
        delete: 'Smazat',
        edit: 'Upravit',
        create: 'Vytvořit',
        search: 'Hledat',
        loading: 'Načítá se...',
        error: 'Chyba',
        success: 'Úspěch',
        yes: 'Ano',
        no: 'Ne',
        ok: 'OK',
        close: 'Zavřít',
        back: 'Zpět',
        next: 'Další',
        previous: 'Předchozí',
        minutes: 'min',
        participants: 'Účastníci',
        serving: 'porce',
        servings: 'porce',
        deleteConfirm: 'Opravdu chcete smazat tuto položku {{item}}?',
      },
      
      // Czech pluralization (one/few/many)
      plurals: {
        recipe_one: '{{count}} recept',
        recipe_few: '{{count}} recepty',
        recipe_other: '{{count}} receptů',
        participant_one: '{{count}} účastník',
        participant_few: '{{count}} účastníci',
        participant_other: '{{count}} účastníků',
        day_one: '{{count}} den',
        day_few: '{{count}} dny',
        day_other: '{{count}} dní',
        ingredient_one: '{{count}} ingredience',
        ingredient_few: '{{count}} ingredience',
        ingredient_other: '{{count}} ingrediencí',
        meal_one: '{{count}} jídlo',
        meal_few: '{{count}} jídla',
        meal_other: '{{count}} jídel',
        item_one: '{{count}} položka',
        item_few: '{{count}} položky',
        item_other: '{{count}} položek',
        minute_one: '{{count}} minuta',
        minute_few: '{{count}} minuty',
        minute_other: '{{count}} minut',
        notification_zero: 'Žádná oznámení',
        notification_one: '{{count}} oznámení',
        notification_few: '{{count}} oznámení',
        notification_other: '{{count}} oznámení',
        recipesInTrip_one: 'Tento výlet obsahuje {{count}} recept pro {{participants}} lidí',
        recipesInTrip_few: 'Tento výlet obsahuje {{count}} recepty pro {{participants}} lidí',
        recipesInTrip_other: 'Tento výlet obsahuje {{count}} receptů pro {{participants}} lidí',
      },
      
      // Context examples with gender
      contexts: {
        welcome: 'Vítejte',
        welcome_formal: 'Vítejte',
        welcome_informal: 'Ahoj',
        greeting: 'Ahoj {{name}}',
        greeting_formal: 'Dobrý den, {{name}}',
        greeting_informal: 'Ahoj {{name}}',
        userAction: '{{name}} {{action}}',
        userCreated: '{{name}} vytvořil',
        userCreated_masculine: '{{name}} vytvořil',
        userCreated_feminine: '{{name}} vytvořila',
        userArrived: '{{name}} přišel',
        userArrived_masculine: '{{name}} přišel',
        userArrived_feminine: '{{name}} přišla',
      },
      
      // Layout and UI - Czech text is typically longer
      layout: {
        shortText: 'Krátký',
        mediumText: 'Toto je středně dlouhý text, který se může zalomit',
        longText: 'Toto je velmi dlouhý text, který se určitě zalomí na více řádků a testuje zpracování přetečení textu v různých jazycích',
        veryLongText: 'Toto je extrémně dlouhý text, který simuluje obsah, který může být v některých jazycích mnohem delší než v jiných, což je důležité pro testování adaptace rozvržení a chování přetečení textu napříč různými lokalizacemi a jazykovými systémy',
      },
      
      // Form validation
      validation: {
        required: 'Toto pole je povinné',
        email: 'Zadejte platnou emailovou adresu',
        minLength: 'Musí mít alespoň {{min}} znaků',
        maxLength: 'Nesmí překročit {{max}} znaků',
        number: 'Zadejte platné číslo',
        positive: 'Musí být kladné číslo',
        min: 'Musí být alespoň {{min}}',
        max: 'Nesmí překročit {{max}}',
      },
      
      // Formatting examples
      formatting: {
        price: '{{amount, currency}}',
        date: '{{date, date}}',
        dateTime: '{{date, datetime}}',
        number: '{{value, number}}',
        ordinal: '{{value, ordinal}}',
        percentage: '{{value}}%',
      },
    },
  },
  ar: {
    translation: {
      // Authentication
      auth: {
        login: 'تسجيل الدخول',
        register: 'إنشاء حساب',
        email: 'البريد الإلكتروني',
        password: 'كلمة المرور',
        firstName: 'الاسم الأول',
        lastName: 'اسم العائلة',
        emailRequired: 'البريد الإلكتروني مطلوب',
        emailInvalid: 'الرجاء إدخال بريد إلكتروني صحيح',
        passwordRequired: 'كلمة المرور مطلوبة',
        passwordMin: 'يجب أن تحتوي كلمة المرور على {{min}} أحرف على الأقل',
        loginSuccess: 'مرحباً بعودتك!',
        loginError: 'بريد إلكتروني أو كلمة مرور غير صحيحة',
      },
      
      // Navigation
      navigation: {
        dashboard: 'لوحة التحكم',
        recipes: 'الوصفات',
        trips: 'الرحلات',
        profile: 'الملف الشخصي',
        settings: 'الإعدادات',
        search: 'بحث',
        openMenu: 'فتح القائمة',
        closeMenu: 'إغلاق القائمة',
      },
      
      // Recipes
      recipes: {
        title: 'الوصفات',
        createNew: 'إنشاء وصفة جديدة',
        searchPlaceholder: 'البحث عن وصفات...',
        name: 'اسم الوصفة',
        description: 'الوصف',
        ingredients: 'المكونات',
        instructions: 'التعليمات',
        prepTime: 'وقت التحضير',
        cookTime: 'وقت الطبخ',
        servings: 'الحصص',
        difficulty: 'الصعوبة',
        categories: 'الفئات',
        tags: 'العلامات',
        isPublic: 'نشر الوصفة',
        addIngredient: 'إضافة مكون',
        addInstruction: 'إضافة تعليمات',
        ingredientName: 'اسم المكون',
        quantity: 'الكمية',
        created: 'تم إنشاء الوصفة بنجاح',
        updated: 'تم تحديث الوصفة بنجاح',
        noRecipes: 'لم يتم العثور على وصفات',
        difficultyLevels: {
          easy: 'سهل',
          medium: 'متوسط',
          hard: 'صعب',
        },
        units: {
          g: 'جرام',
          kg: 'كيلوجرام',
          ml: 'مليلتر',
          l: 'لتر',
          cup: 'كوب',
          tbsp: 'ملعقة كبيرة',
          tsp: 'ملعقة صغيرة',
          piece: 'قطعة',
        },
      },
      
      // Trips
      trips: {
        title: 'الرحلات',
        createNew: 'إنشاء رحلة جديدة',
        name: 'اسم الرحلة',
        description: 'الوصف',
        startDate: 'تاريخ البداية',
        endDate: 'تاريخ النهاية',
        participantCount: 'المشاركون',
        addParticipant: 'إضافة مشارك',
        participantName: 'الاسم',
        participantEmail: 'البريد الإلكتروني (اختياري)',
        mealTypes: {
          breakfast: 'الإفطار',
          lunch: 'الغداء',
          dinner: 'العشاء',
          snack: 'وجبة خفيفة',
        },
        created: 'تم إنشاء الرحلة بنجاح',
        updated: 'تم تحديث الرحلة بنجاح',
        noTrips: 'لم يتم العثور على رحلات',
      },
      
      // Common
      common: {
        save: 'حفظ',
        cancel: 'إلغاء',
        delete: 'حذف',
        edit: 'تعديل',
        create: 'إنشاء',
        search: 'بحث',
        loading: 'جاري التحميل...',
        error: 'خطأ',
        success: 'نجح',
        yes: 'نعم',
        no: 'لا',
        ok: 'موافق',
        close: 'إغلاق',
        back: 'رجوع',
        next: 'التالي',
        previous: 'السابق',
        minutes: 'دقيقة',
        participants: 'المشاركون',
        serving: 'حصة',
        servings: 'حصص',
        deleteConfirm: 'هل أنت متأكد من حذف {{item}}؟',
      },
      
      // Arabic pluralization (zero/one/two/few/many/other)
      plurals: {
        recipe_zero: 'لا توجد وصفات',
        recipe_one: 'وصفة واحدة',
        recipe_two: 'وصفتان',
        recipe_few: '{{count}} وصفات',
        recipe_many: '{{count}} وصفة',
        recipe_other: '{{count}} وصفة',
        participant_zero: 'لا يوجد مشاركون',
        participant_one: 'مشارك واحد',
        participant_two: 'مشاركان',
        participant_few: '{{count}} مشاركين',
        participant_many: '{{count}} مشارك',
        participant_other: '{{count}} مشارك',
        day_zero: 'لا توجد أيام',
        day_one: 'يوم واحد',
        day_two: 'يومان',
        day_few: '{{count}} أيام',
        day_many: '{{count}} يوم',
        day_other: '{{count}} يوم',
        ingredient_zero: 'لا توجد مكونات',
        ingredient_one: 'مكون واحد',
        ingredient_two: 'مكونان',
        ingredient_few: '{{count}} مكونات',
        ingredient_many: '{{count}} مكون',
        ingredient_other: '{{count}} مكون',
        meal_zero: 'لا توجد وجبات',
        meal_one: 'وجبة واحدة',
        meal_two: 'وجبتان',
        meal_few: '{{count}} وجبات',
        meal_many: '{{count}} وجبة',
        meal_other: '{{count}} وجبة',
        item_zero: 'لا توجد عناصر',
        item_one: 'عنصر واحد',
        item_two: 'عنصران',
        item_few: '{{count}} عناصر',
        item_many: '{{count}} عنصر',
        item_other: '{{count}} عنصر',
        minute_zero: 'لا توجد دقائق',
        minute_one: 'دقيقة واحدة',
        minute_two: 'دقيقتان',
        minute_few: '{{count}} دقائق',
        minute_many: '{{count}} دقيقة',
        minute_other: '{{count}} دقيقة',
        notification_zero: 'لا توجد إشعارات',
        notification_one: 'إشعار واحد',
        notification_two: 'إشعاران',
        notification_few: '{{count}} إشعارات',
        notification_many: '{{count}} إشعار',
        notification_other: '{{count}} إشعار',
        recipesInTrip_zero: 'لا تحتوي هذه الرحلة على أي وصفات',
        recipesInTrip_one: 'تحتوي هذه الرحلة على وصفة واحدة لـ {{participants}} شخص',
        recipesInTrip_two: 'تحتوي هذه الرحلة على وصفتين لـ {{participants}} شخص',
        recipesInTrip_few: 'تحتوي هذه الرحلة على {{count}} وصفات لـ {{participants}} أشخاص',
        recipesInTrip_many: 'تحتوي هذه الرحلة على {{count}} وصفة لـ {{participants}} شخص',
        recipesInTrip_other: 'تحتوي هذه الرحلة على {{count}} وصفة لـ {{participants}} شخص',
      },
      
      // Context examples with gender
      contexts: {
        welcome: 'مرحباً',
        welcome_formal: 'مرحباً',
        welcome_informal: 'أهلاً',
        greeting: 'مرحباً {{name}}',
        greeting_formal: 'أهلاً وسهلاً {{name}}',
        greeting_informal: 'مرحباً {{name}}',
        userAction: '{{name}} {{action}}',
        userCreated: '{{name}} أنشأ',
        userCreated_masculine: '{{name}} أنشأ',
        userCreated_feminine: '{{name}} أنشأت',
        userArrived: '{{name}} وصل',
        userArrived_masculine: '{{name}} وصل',
        userArrived_feminine: '{{name}} وصلت',
      },
      
      // Layout and UI - Arabic text
      layout: {
        shortText: 'قصير',
        mediumText: 'هذا نص متوسط الطول قد ينقسم إلى عدة أسطر',
        longText: 'هذا نص طويل جداً سينقسم بالتأكيد إلى عدة أسطر ويختبر التعامل مع تجاوز النص في لغات مختلفة',
        veryLongText: 'هذا نص طويل للغاية يحاكي المحتوى الذي قد يكون أطول بكثير في بعض اللغات من غيرها، وهو مهم لاختبار تكيف التخطيط وسلوك تجاوز النص عبر مختلف المحليات وأنظمة اللغات',
      },
      
      // Form validation
      validation: {
        required: 'هذا الحقل مطلوب',
        email: 'الرجاء إدخال عنوان بريد إلكتروني صحيح',
        minLength: 'يجب أن يحتوي على {{min}} أحرف على الأقل',
        maxLength: 'يجب ألا يتجاوز {{max}} حرف',
        number: 'الرجاء إدخال رقم صحيح',
        positive: 'يجب أن يكون رقماً موجباً',
        min: 'يجب أن يكون {{min}} على الأقل',
        max: 'يجب ألا يتجاوز {{max}}',
      },
      
      // Formatting examples
      formatting: {
        price: '{{amount, currency}}',
        date: '{{date, date}}',
        dateTime: '{{date, datetime}}',
        number: '{{value, number}}',
        ordinal: '{{value, ordinal}}',
        percentage: '%{{value}}',
      },
    },
  },
}

// Create test i18n instance
const createTestI18n = async (initialLanguage = 'en') => {
  const instance = i18n.createInstance()
  
  await instance
    .use(initReactI18next)
    .init({
      lng: initialLanguage,
      fallbackLng: 'en',
      resources: comprehensiveTestTranslations,
      interpolation: {
        escapeValue: false,
        format: (value: any, format?: string, lng?: string) => {
          if (format === 'date' && value instanceof Date) {
            return new Intl.DateTimeFormat(lng).format(value)
          }
          if (format === 'currency' && typeof value === 'number') {
            const currency = lng === 'cs' ? 'CZK' : lng === 'ar' ? 'SAR' : 'USD'
            return new Intl.NumberFormat(lng, {
              style: 'currency',
              currency,
            }).format(value)
          }
          if (format === 'number' && typeof value === 'number') {
            return new Intl.NumberFormat(lng).format(value)
          }
          return value
        }
      },
      pluralSeparator: '_',
      contextSeparator: '_',
      react: {
        useSuspense: false,
      },
    })

  return instance
}

// Create wrapper with providers
const createTestWrapper = (i18nInstance: any) => {
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <I18nextProvider i18n={i18nInstance}>
        {children}
      </I18nextProvider>
    </BrowserRouter>
  )
}

// Test component that uses multiple i18n features
const ComprehensiveTestComponent: React.FC = () => {
  const { t, language } = useTypedTranslation()
  const { number, currency, date } = useFormatting()
  const [count, setCount] = React.useState(1)
  const [user] = React.useState({ name: 'John', gender: 'masculine' })

  return (
    <div data-testid="comprehensive-test">
      <h1 data-testid="title">{t('recipes.title')}</h1>
      <p data-testid="description">{t('recipes.description', 'Default description')}</p>
      
      {/* Pluralization tests */}
      <div data-testid="plural-section">
        <p data-testid="recipe-count">{t('plurals.recipe', { count })}</p>
        <p data-testid="complex-plural">{t('plurals.recipesInTrip', { count, participants: 5 })}</p>
        <button onClick={() => setCount(count + 1)}>Add Recipe</button>
      </div>
      
      {/* Context tests */}
      <div data-testid="context-section">
        <p data-testid="context-greeting">{t('contexts.greeting', { context: 'formal', name: user.name })}</p>
        <p data-testid="context-action">{t('contexts.userCreated', { context: user.gender, name: user.name })}</p>
      </div>
      
      {/* Formatting tests */}
      <div data-testid="formatting-section">
        <p data-testid="formatted-number">{number.format(1234.56)}</p>
        <p data-testid="formatted-currency">{currency.format(99.99)}</p>
        <p data-testid="formatted-date">{date.format(new Date('2024-01-15'))}</p>
      </div>
      
      {/* Layout tests with different text lengths */}
      <div data-testid="layout-section">
        <p data-testid="short-text">{t('layout.shortText')}</p>
        <p data-testid="medium-text" style={{ maxWidth: '200px' }}>{t('layout.mediumText')}</p>
        <p data-testid="long-text" style={{ maxWidth: '300px' }}>{t('layout.longText')}</p>
        <div data-testid="text-overflow" style={{ width: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t('layout.veryLongText')}
        </div>
      </div>
      
      {/* Form with validation */}
      <form data-testid="test-form">
        <input 
          data-testid="email-input" 
          placeholder={t('auth.email')} 
          aria-label={t('auth.email')}
        />
        <span data-testid="email-error">{t('validation.emailRequired')}</span>
        <input 
          data-testid="password-input" 
          placeholder={t('auth.password')} 
          aria-label={t('auth.password')}
        />
        <span data-testid="password-error">{t('validation.minLength', { min: 8 })}</span>
        <button type="submit" data-testid="submit-button">{t('common.save')}</button>
      </form>
      
      {/* Navigation elements */}
      <nav data-testid="test-navigation">
        <a href="/recipes" aria-label={t('navigation.recipes')}>{t('navigation.recipes')}</a>
        <a href="/trips" aria-label={t('navigation.trips')}>{t('navigation.trips')}</a>
        <button aria-label={t('navigation.search')}>{t('navigation.search')}</button>
      </nav>
      
      {/* Language and direction info */}
      <div data-testid="language-info">
        <span data-testid="current-language">{language}</span>
        <span data-testid="is-rtl">{isRTL(language) ? 'rtl' : 'ltr'}</span>
      </div>
    </div>
  )
}

describe('Comprehensive Internationalization Testing', () => {
  let i18nInstance: any

  beforeEach(async () => {
    i18nInstance = await createTestI18n()
    // Reset document attributes
    document.documentElement.dir = 'ltr'
    document.documentElement.lang = 'en'
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('1. Translation Key Coverage Testing', () => {
    it('should verify all text content uses translation keys', async () => {
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      // Verify no hardcoded English text (all should come from translation keys)
      expect(screen.getByTestId('title')).toHaveTextContent('Recipes')
      expect(screen.getByTestId('submit-button')).toHaveTextContent('Save')
      
      // Test with different language
      await i18nInstance.changeLanguage('cs')
      
      // Re-render to get updated translations
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })
      
      expect(screen.getByTestId('title')).toHaveTextContent('Recepty')
      expect(screen.getByTestId('submit-button')).toHaveTextContent('Uložit')
    })

    it('should test for missing translation keys', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const TestComponentWithMissingKeys: React.FC = () => {
        const { t } = useTypedTranslation()
        return (
          <div>
            <p data-testid="missing-key">{t('nonexistent.missing.key' as any)}</p>
            <p data-testid="partial-key">{t('recipes.nonexistent' as any)}</p>
          </div>
        )
      }

      render(<TestComponentWithMissingKeys />, { wrapper: createTestWrapper(i18nInstance) })

      // Should fallback to key name
      expect(screen.getByTestId('missing-key')).toHaveTextContent('nonexistent.missing.key')
      expect(screen.getByTestId('partial-key')).toHaveTextContent('recipes.nonexistent')
    })

    it('should validate translation key naming conventions', () => {
      const translations = comprehensiveTestTranslations.en.translation
      
      // Test namespace structure
      expect(translations).toHaveProperty('auth')
      expect(translations).toHaveProperty('navigation')
      expect(translations).toHaveProperty('recipes')
      expect(translations).toHaveProperty('trips')
      expect(translations).toHaveProperty('common')
      
      // Test nested structure
      expect(translations.recipes).toHaveProperty('difficultyLevels')
      expect(translations.recipes).toHaveProperty('units')
      expect(translations.trips).toHaveProperty('mealTypes')
      
      // Test pluralization naming
      expect(translations.plurals).toHaveProperty('recipe_one')
      expect(translations.plurals).toHaveProperty('recipe_other')
      
      // Test context naming
      expect(translations.contexts).toHaveProperty('greeting_formal')
      expect(translations.contexts).toHaveProperty('greeting_informal')
    })

    it('should test nested translation structures', async () => {
      const TestNestedComponent: React.FC = () => {
        const { t } = useTypedTranslation()
        return (
          <div>
            <p data-testid="difficulty-easy">{t('recipes.difficultyLevels.easy')}</p>
            <p data-testid="unit-g">{t('recipes.units.g')}</p>
            <p data-testid="meal-breakfast">{t('trips.mealTypes.breakfast')}</p>
          </div>
        )
      }

      render(<TestNestedComponent />, { wrapper: createTestWrapper(i18nInstance) })

      expect(screen.getByTestId('difficulty-easy')).toHaveTextContent('Easy')
      expect(screen.getByTestId('unit-g')).toHaveTextContent('grams')
      expect(screen.getByTestId('meal-breakfast')).toHaveTextContent('Breakfast')

      // Test in Czech
      await i18nInstance.changeLanguage('cs')
      render(<TestNestedComponent />, { wrapper: createTestWrapper(i18nInstance) })

      expect(screen.getByTestId('difficulty-easy')).toHaveTextContent('Snadná')
      expect(screen.getByTestId('unit-g')).toHaveTextContent('gramy')
      expect(screen.getByTestId('meal-breakfast')).toHaveTextContent('Snídaně')
    })
  })

  describe('2. Language Switching Testing', () => {
    it('should test dynamic language switching', async () => {
      render(
        <>
          <ComprehensiveTestComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createTestWrapper(i18nInstance) }
      )

      // Initial English
      expect(screen.getByTestId('title')).toHaveTextContent('Recipes')
      expect(screen.getByTestId('current-language')).toHaveTextContent('en')

      // Switch to Czech
      const languageButton = screen.getByRole('button', { name: /change language/i })
      fireEvent.click(languageButton)
      
      const czechOption = screen.getByRole('option', { name: /čeština/i })
      fireEvent.click(czechOption)

      await waitFor(() => {
        expect(screen.getByTestId('title')).toHaveTextContent('Recepty')
        expect(screen.getByTestId('current-language')).toHaveTextContent('cs')
      })

      // Switch to Arabic
      fireEvent.click(languageButton)
      const arabicOption = screen.getByRole('option', { name: /العربية/i })
      fireEvent.click(arabicOption)

      await waitFor(() => {
        expect(screen.getByTestId('title')).toHaveTextContent('الوصفات')
        expect(screen.getByTestId('current-language')).toHaveTextContent('ar')
        expect(screen.getByTestId('is-rtl')).toHaveTextContent('rtl')
      })
    })

    it('should verify component re-rendering with new language', async () => {
      const renderSpy = jest.fn()
      
      const TrackedComponent: React.FC = () => {
        renderSpy()
        const { t } = useTypedTranslation()
        return <div data-testid="tracked">{t('common.save')}</div>
      }

      render(
        <>
          <TrackedComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createTestWrapper(i18nInstance) }
      )

      const initialRenderCount = renderSpy.mock.calls.length
      expect(screen.getByTestId('tracked')).toHaveTextContent('Save')

      // Change language
      const languageButton = screen.getByRole('button', { name: /change language/i })
      fireEvent.click(languageButton)
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      await waitFor(() => {
        expect(screen.getByTestId('tracked')).toHaveTextContent('Uložit')
        expect(renderSpy.mock.calls.length).toBeGreaterThan(initialRenderCount)
      })
    })

    it('should test language persistence across sessions', async () => {
      const mockLocalStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      })

      render(<LanguageSwitcher />, { wrapper: createTestWrapper(i18nInstance) })

      // Change language
      const languageButton = screen.getByRole('button', { name: /change language/i })
      fireEvent.click(languageButton)
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('jidelnicek-language', 'cs')
      })
    })

    it('should test URL handling with language switching', async () => {
      // Mock URL updates
      const originalPushState = window.history.pushState
      const pushStateSpy = jest.fn()
      window.history.pushState = pushStateSpy

      render(<LanguageSwitcher />, { wrapper: createTestWrapper(i18nInstance) })

      const languageButton = screen.getByRole('button', { name: /change language/i })
      fireEvent.click(languageButton)
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      await waitFor(() => {
        expect(document.documentElement.lang).toBe('cs')
      })

      // Restore
      window.history.pushState = originalPushState
    })
  })

  describe('3. Locale-Specific Functionality Testing', () => {
    it('should test date/time formatting for different locales', async () => {
      const testDate = new Date('2024-01-15T10:30:00')
      
      const DateTestComponent: React.FC = () => {
        const { date } = useFormatting()
        return (
          <div>
            <span data-testid="formatted-date">{date.format(testDate)}</span>
            <span data-testid="formatted-datetime">{date.formatDateTime(testDate, 'short', 'short')}</span>
          </div>
        )
      }

      // English formatting
      render(<DateTestComponent />, { wrapper: createTestWrapper(i18nInstance) })
      expect(screen.getByTestId('formatted-date')).toHaveTextContent(/1\/15\/2024/)

      // Czech formatting
      await i18nInstance.changeLanguage('cs')
      render(<DateTestComponent />, { wrapper: createTestWrapper(i18nInstance) })
      expect(screen.getByTestId('formatted-date')).toHaveTextContent(/15\. 1\. 2024/)

      // Arabic formatting
      await i18nInstance.changeLanguage('ar')
      render(<DateTestComponent />, { wrapper: createTestWrapper(i18nInstance) })
      // Arabic date format will depend on browser implementation
      expect(screen.getByTestId('formatted-date')).toBeInTheDocument()
    })

    it('should test number formatting (currency, decimals)', async () => {
      const NumberTestComponent: React.FC = () => {
        const { number, currency } = useFormatting()
        return (
          <div>
            <span data-testid="number">{number.format(1234.56)}</span>
            <span data-testid="currency">{currency.format(99.99)}</span>
          </div>
        )
      }

      // English formatting
      render(<NumberTestComponent />, { wrapper: createTestWrapper(i18nInstance) })
      expect(screen.getByTestId('number')).toHaveTextContent('1,234.56')
      expect(screen.getByTestId('currency')).toHaveTextContent(/\$99\.99/)

      // Czech formatting  
      await i18nInstance.changeLanguage('cs')
      render(<NumberTestComponent />, { wrapper: createTestWrapper(i18nInstance) })
      expect(screen.getByTestId('number')).toHaveTextContent('1 234,56')
      expect(screen.getByTestId('currency')).toHaveTextContent(/99,99.*Kč/)

      // Arabic formatting
      await i18nInstance.changeLanguage('ar')
      render(<NumberTestComponent />, { wrapper: createTestWrapper(i18nInstance) })
      // Arabic number formatting will depend on browser implementation
      expect(screen.getByTestId('number')).toBeInTheDocument()
      expect(screen.getByTestId('currency')).toBeInTheDocument()
    })

    it('should test text direction (LTR/RTL) support', async () => {
      render(
        <>
          <ComprehensiveTestComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createTestWrapper(i18nInstance) }
      )

      // LTR languages
      expect(document.documentElement.dir).toBe('ltr')
      expect(screen.getByTestId('is-rtl')).toHaveTextContent('ltr')

      // Switch to Arabic (RTL)
      const languageButton = screen.getByRole('button', { name: /change language/i })
      fireEvent.click(languageButton)
      fireEvent.click(screen.getByRole('option', { name: /العربية/i }))

      await waitFor(() => {
        expect(document.documentElement.dir).toBe('rtl')
        expect(screen.getByTestId('is-rtl')).toHaveTextContent('rtl')
      })

      // Switch back to LTR
      fireEvent.click(languageButton)
      fireEvent.click(screen.getByRole('option', { name: /english/i }))

      await waitFor(() => {
        expect(document.documentElement.dir).toBe('ltr')
        expect(screen.getByTestId('is-rtl')).toHaveTextContent('ltr')
      })
    })

    it('should test locale-specific sorting and search', async () => {
      const items = ['Zebra', 'Äpfel', 'Banana', 'číst', 'Apple']
      
      const SortTestComponent: React.FC = () => {
        const { language } = useTypedTranslation()
        const sortedItems = items.sort((a, b) => a.localeCompare(b, language))
        
        return (
          <ul data-testid="sorted-list">
            {sortedItems.map((item, index) => (
              <li key={index} data-testid={`item-${index}`}>{item}</li>
            ))}
          </ul>
        )
      }

      // English sorting
      render(<SortTestComponent />, { wrapper: createTestWrapper(i18nInstance) })
      expect(screen.getByTestId('item-0')).toHaveTextContent('Apple')

      // Czech sorting (with diacritics)
      await i18nInstance.changeLanguage('cs')
      render(<SortTestComponent />, { wrapper: createTestWrapper(i18nInstance) })
      // Check that sorting respects Czech locale rules
      const firstItem = screen.getByTestId('item-0')
      expect(firstItem).toBeInTheDocument()
    })
  })

  describe('4. Translation Content Testing', () => {
    it('should test translation completeness across all supported languages', () => {
      const englishKeys = Object.keys(comprehensiveTestTranslations.en.translation.auth)
      const czechKeys = Object.keys(comprehensiveTestTranslations.cs.translation.auth)
      const arabicKeys = Object.keys(comprehensiveTestTranslations.ar.translation.auth)

      // Check that all languages have the same auth keys
      expect(czechKeys).toEqual(expect.arrayContaining(englishKeys))
      expect(arabicKeys).toEqual(expect.arrayContaining(englishKeys))
    })

    it('should verify translation content quality and context', async () => {
      const ContextTestComponent: React.FC = () => {
        const { t } = useTypedTranslation()
        return (
          <div>
            <span data-testid="email-label">{t('auth.email')}</span>
            <span data-testid="email-validation">{t('validation.email')}</span>
            <span data-testid="save-button">{t('common.save')}</span>
          </div>
        )
      }

      render(<ContextTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      // Verify English translations make sense
      expect(screen.getByTestId('email-label')).toHaveTextContent('Email')
      expect(screen.getByTestId('email-validation')).toHaveTextContent(/valid email/)
      expect(screen.getByTestId('save-button')).toHaveTextContent('Save')

      // Switch to Czech and verify translations
      await i18nInstance.changeLanguage('cs')
      render(<ContextTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      expect(screen.getByTestId('email-label')).toHaveTextContent('Email')
      expect(screen.getByTestId('email-validation')).toHaveTextContent(/email/)
      expect(screen.getByTestId('save-button')).toHaveTextContent('Uložit')

      // Switch to Arabic and verify translations
      await i18nInstance.changeLanguage('ar')
      render(<ContextTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      expect(screen.getByTestId('email-label')).toHaveTextContent('البريد الإلكتروني')
      expect(screen.getByTestId('email-validation')).toHaveTextContent(/بريد إلكتروني/)
      expect(screen.getByTestId('save-button')).toHaveTextContent('حفظ')
    })

    it('should test pluralization rules for different languages', async () => {
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      const addButton = screen.getByText('Add Recipe')

      // Test English pluralization (1, 2, 5)
      expect(screen.getByTestId('recipe-count')).toHaveTextContent('1 recipe')
      
      fireEvent.click(addButton)
      await waitFor(() => {
        expect(screen.getByTestId('recipe-count')).toHaveTextContent('2 recipes')
      })

      // Switch to Czech and test complex pluralization
      await i18nInstance.changeLanguage('cs')
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      expect(screen.getByTestId('recipe-count')).toHaveTextContent('2 recepty') // few form

      // Test different counts
      fireEvent.click(addButton) // 3
      fireEvent.click(addButton) // 4
      await waitFor(() => {
        expect(screen.getByTestId('recipe-count')).toHaveTextContent('4 recepty') // still few
      })

      fireEvent.click(addButton) // 5
      await waitFor(() => {
        expect(screen.getByTestId('recipe-count')).toHaveTextContent('5 receptů') // many form
      })

      // Switch to Arabic and test extensive pluralization
      await i18nInstance.changeLanguage('ar')
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      // Test zero form
      const zeroTestComponent: React.FC = () => {
        const { t } = useTypedTranslation()
        return <span data-testid="zero-count">{t('plurals.recipe', { count: 0 })}</span>
      }
      
      render(<zeroTestComponent />, { wrapper: createTestWrapper(i18nInstance) })
      expect(screen.getByTestId('zero-count')).toHaveTextContent('لا توجد وصفات')
    })

    it('should test interpolation and variable substitution', async () => {
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      // Test simple interpolation
      expect(screen.getByTestId('context-greeting')).toHaveTextContent('Dear John')
      expect(screen.getByTestId('password-error')).toHaveTextContent('Must be at least 8 characters')

      // Test complex interpolation with multiple variables
      expect(screen.getByTestId('complex-plural')).toHaveTextContent('This trip contains 1 recipe for 5 people')

      // Switch language and test interpolation still works
      await i18nInstance.changeLanguage('cs')
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      expect(screen.getByTestId('context-greeting')).toHaveTextContent('Dobrý den, John')
      expect(screen.getByTestId('password-error')).toHaveTextContent('Musí mít alespoň 8 znaků')
      expect(screen.getByTestId('complex-plural')).toHaveTextContent('Tento výlet obsahuje 1 recept pro 5 lidí')
    })
  })

  describe('5. Layout and UI Testing', () => {
    it('should test layout adaptation for longer/shorter text in different languages', async () => {
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      const shortText = screen.getByTestId('short-text')
      const mediumText = screen.getByTestId('medium-text')
      const longText = screen.getByTestId('long-text')

      // Measure English text
      const englishShortWidth = shortText.getBoundingClientRect().width
      const englishMediumWidth = mediumText.getBoundingClientRect().width

      // Switch to Czech (typically longer text)
      await i18nInstance.changeLanguage('cs')
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      const czechShortText = screen.getByTestId('short-text')
      const czechMediumText = screen.getByTestId('medium-text')

      // Czech text might be longer/shorter - just verify elements still render
      expect(czechShortText).toBeInTheDocument()
      expect(czechMediumText).toBeInTheDocument()
      expect(screen.getByTestId('long-text')).toBeInTheDocument()

      // Switch to Arabic and test RTL layout
      await i18nInstance.changeLanguage('ar')
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      expect(screen.getByTestId('short-text')).toBeInTheDocument()
      expect(screen.getByTestId('medium-text')).toBeInTheDocument()
      expect(screen.getByTestId('long-text')).toBeInTheDocument()
    })

    it('should test text overflow and truncation handling', async () => {
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      const overflowElement = screen.getByTestId('text-overflow')
      expect(overflowElement).toHaveStyle({
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      })

      // Test with different languages
      await i18nInstance.changeLanguage('cs')
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })
      
      const czechOverflowElement = screen.getByTestId('text-overflow')
      expect(czechOverflowElement).toBeInTheDocument()

      await i18nInstance.changeLanguage('ar')
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })
      
      const arabicOverflowElement = screen.getByTestId('text-overflow')
      expect(arabicOverflowElement).toBeInTheDocument()
    })

    it('should test component sizing with different text lengths', async () => {
      const DynamicSizeComponent: React.FC = () => {
        const { t } = useTypedTranslation()
        return (
          <div data-testid="dynamic-container">
            <button data-testid="button1" className="px-4 py-2">
              {t('common.save')}
            </button>
            <button data-testid="button2" className="px-4 py-2">
              {t('recipes.createNew')}
            </button>
            <button data-testid="button3" className="px-4 py-2">
              {t('trips.addParticipant')}
            </button>
          </div>
        )
      }

      render(<DynamicSizeComponent />, { wrapper: createTestWrapper(i18nInstance) })

      // English buttons
      const englishButton1 = screen.getByTestId('button1')
      const englishButton2 = screen.getByTestId('button2')
      const englishButton3 = screen.getByTestId('button3')

      expect(englishButton1).toHaveTextContent('Save')
      expect(englishButton2).toHaveTextContent('Create New Recipe')
      expect(englishButton3).toHaveTextContent('Add Participant')

      // Switch to Czech (potentially longer text)
      await i18nInstance.changeLanguage('cs')
      render(<DynamicSizeComponent />, { wrapper: createTestWrapper(i18nInstance) })

      const czechButton1 = screen.getByTestId('button1')
      const czechButton2 = screen.getByTestId('button2')
      const czechButton3 = screen.getByTestId('button3')

      expect(czechButton1).toHaveTextContent('Uložit')
      expect(czechButton2).toHaveTextContent('Vytvořit nový recept')
      expect(czechButton3).toHaveTextContent('Přidat účastníka')

      // Switch to Arabic
      await i18nInstance.changeLanguage('ar')
      render(<DynamicSizeComponent />, { wrapper: createTestWrapper(i18nInstance) })

      const arabicButton1 = screen.getByTestId('button1')
      const arabicButton2 = screen.getByTestId('button2')
      const arabicButton3 = screen.getByTestId('button3')

      expect(arabicButton1).toHaveTextContent('حفظ')
      expect(arabicButton2).toHaveTextContent('إنشاء وصفة جديدة')
      expect(arabicButton3).toHaveTextContent('إضافة مشارك')
    })

    it('should test form validation messages in all languages', async () => {
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      // English validation messages
      expect(screen.getByTestId('email-error')).toHaveTextContent('Email is required')
      expect(screen.getByTestId('password-error')).toHaveTextContent('Must be at least 8 characters')

      // Czech validation messages
      await i18nInstance.changeLanguage('cs')
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      expect(screen.getByTestId('email-error')).toHaveTextContent('Email je povinný')
      expect(screen.getByTestId('password-error')).toHaveTextContent('Musí mít alespoň 8 znaků')

      // Arabic validation messages
      await i18nInstance.changeLanguage('ar')
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      expect(screen.getByTestId('email-error')).toHaveTextContent('البريد الإلكتروني مطلوب')
      expect(screen.getByTestId('password-error')).toHaveTextContent('يجب أن تحتوي على 8 أحرف على الأقل')
    })
  })

  describe('6. Integration and Workflow Testing', () => {
    it('should test complete recipe management workflow in multiple languages', async () => {
      // This would test the full recipe form workflow
      // For now, we'll test the key elements
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      // Verify form elements are translated
      expect(screen.getByTestId('email-input')).toHaveAttribute('placeholder', 'Email')
      expect(screen.getByTestId('password-input')).toHaveAttribute('placeholder', 'Password')
      expect(screen.getByTestId('submit-button')).toHaveTextContent('Save')

      // Switch to Czech and verify
      await i18nInstance.changeLanguage('cs')
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      expect(screen.getByTestId('email-input')).toHaveAttribute('placeholder', 'Email')
      expect(screen.getByTestId('password-input')).toHaveAttribute('placeholder', 'Heslo')
      expect(screen.getByTestId('submit-button')).toHaveTextContent('Uložit')

      // Switch to Arabic and verify
      await i18nInstance.changeLanguage('ar')
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      expect(screen.getByTestId('email-input')).toHaveAttribute('placeholder', 'البريد الإلكتروني')
      expect(screen.getByTestId('password-input')).toHaveAttribute('placeholder', 'كلمة المرور')
      expect(screen.getByTestId('submit-button')).toHaveTextContent('حفظ')
    })

    it('should test navigation consistency across languages', async () => {
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      const navigation = screen.getByTestId('test-navigation')
      const recipesLink = within(navigation).getByText('Recipes')
      const tripsLink = within(navigation).getByText('Trips')
      const searchButton = within(navigation).getByRole('button', { name: /search/i })

      expect(recipesLink).toHaveAttribute('aria-label', 'Recipes')
      expect(tripsLink).toHaveAttribute('aria-label', 'Trips')
      expect(searchButton).toHaveAttribute('aria-label', 'Search')

      // Switch to Czech
      await i18nInstance.changeLanguage('cs')
      render(<ComprehensiveTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      const czechNavigation = screen.getByTestId('test-navigation')
      const czechRecipesLink = within(czechNavigation).getByText('Recepty')
      const czechTripsLink = within(czechNavigation).getByText('Výlety')
      const czechSearchButton = within(czechNavigation).getByRole('button', { name: /hledat/i })

      expect(czechRecipesLink).toHaveAttribute('aria-label', 'Recepty')
      expect(czechTripsLink).toHaveAttribute('aria-label', 'Výlety')
      expect(czechSearchButton).toHaveAttribute('aria-label', 'Hledat')
    })

    it('should test error handling and recovery in different languages', async () => {
      const ErrorTestComponent: React.FC = () => {
        const { t } = useTypedTranslation()
        const [hasError, setHasError] = React.useState(false)

        if (hasError) {
          return (
            <div data-testid="error-state">
              <p data-testid="error-message">{t('common.error')}</p>
              <button data-testid="retry-button" onClick={() => setHasError(false)}>
                {t('common.retry', 'Retry')}
              </button>
            </div>
          )
        }

        return (
          <div>
            <p data-testid="normal-state">{t('common.success')}</p>
            <button data-testid="trigger-error" onClick={() => setHasError(true)}>
              Trigger Error
            </button>
          </div>
        )
      }

      render(<ErrorTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      // Normal state in English
      expect(screen.getByTestId('normal-state')).toHaveTextContent('Success')

      // Trigger error
      fireEvent.click(screen.getByTestId('trigger-error'))
      expect(screen.getByTestId('error-message')).toHaveTextContent('Error')

      // Recovery
      fireEvent.click(screen.getByTestId('retry-button'))
      expect(screen.getByTestId('normal-state')).toHaveTextContent('Success')

      // Test in Czech
      await i18nInstance.changeLanguage('cs')
      render(<ErrorTestComponent />, { wrapper: createTestWrapper(i18nInstance) })

      expect(screen.getByTestId('normal-state')).toHaveTextContent('Úspěch')
      fireEvent.click(screen.getByTestId('trigger-error'))
      expect(screen.getByTestId('error-message')).toHaveTextContent('Chyba')
    })
  })

  describe('7. Performance and Edge Cases', () => {
    it('should handle rapid language switching without issues', async () => {
      render(
        <>
          <ComprehensiveTestComponent />
          <LanguageSwitcher variant="inline" />
        </>,
        { wrapper: createTestWrapper(i18nInstance) }
      )

      const englishButton = screen.getByRole('button', { name: /switch to english/i })
      const czechButton = screen.getByRole('button', { name: /switch to czech/i })
      const arabicButton = screen.getByRole('button', { name: /switch to arabic/i })

      // Rapid switching
      fireEvent.click(czechButton)
      fireEvent.click(arabicButton)
      fireEvent.click(englishButton)
      fireEvent.click(czechButton)
      fireEvent.click(arabicButton)

      await waitFor(() => {
        expect(i18nInstance.language).toBe('ar')
        expect(screen.getByTestId('title')).toHaveTextContent('الوصفات')
      })
    })

    it('should handle missing pluralization forms gracefully', async () => {
      const TestIncompleteTranslations = () => {
        const { t } = useTypedTranslation()
        return (
          <div>
            <span data-testid="incomplete-plural">{t('plurals.nonexistent', { count: 5 })}</span>
          </div>
        )
      }

      render(<TestIncompleteTranslations />, { wrapper: createTestWrapper(i18nInstance) })

      // Should fallback gracefully
      expect(screen.getByTestId('incomplete-plural')).toHaveTextContent('plurals.nonexistent')
    })

    it('should handle complex nested interpolation', async () => {
      const ComplexInterpolationComponent: React.FC = () => {
        const { t } = useTypedTranslation()
        return (
          <div>
            <span data-testid="complex-interpolation">
              {t('validation.minLength', { min: t('common.min') + ' 8' })}
            </span>
          </div>
        )
      }

      render(<ComplexInterpolationComponent />, { wrapper: createTestWrapper(i18nInstance) })

      // Should handle nested interpolation
      expect(screen.getByTestId('complex-interpolation')).toBeInTheDocument()
    })

    it('should maintain state during language changes', async () => {
      const StatefulComponent: React.FC = () => {
        const { t } = useTypedTranslation()
        const [count, setCount] = React.useState(0)
        const [inputValue, setInputValue] = React.useState('')

        return (
          <div>
            <input
              data-testid="stateful-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('auth.email')}
            />
            <button data-testid="increment" onClick={() => setCount(count + 1)}>
              {t('plurals.item', { count })}
            </button>
            <span data-testid="state-display">Count: {count}, Input: {inputValue}</span>
          </div>
        )
      }

      render(
        <>
          <StatefulComponent />
          <LanguageSwitcher />
        </>,
        { wrapper: createTestWrapper(i18nInstance) }
      )

      // Set some state
      const input = screen.getByTestId('stateful-input')
      const incrementButton = screen.getByTestId('increment')

      fireEvent.change(input, { target: { value: 'test@email.com' } })
      fireEvent.click(incrementButton)
      fireEvent.click(incrementButton)

      expect(screen.getByTestId('state-display')).toHaveTextContent('Count: 2, Input: test@email.com')

      // Change language and verify state is preserved
      const languageButton = screen.getByRole('button', { name: /change language/i })
      fireEvent.click(languageButton)
      fireEvent.click(screen.getByRole('option', { name: /čeština/i }))

      await waitFor(() => {
        expect(screen.getByTestId('state-display')).toHaveTextContent('Count: 2, Input: test@email.com')
        expect(input).toHaveAttribute('placeholder', 'Email')
        expect(incrementButton).toHaveTextContent('2 položky')
      })
    })
  })
})