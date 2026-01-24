# FoodPlan

Web app for planning meals and grocery shopping.

## Running locally

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to test the app.

## Planned improvements

### Accounts

1. When registering, the user must enter a name
2. Allow registering with Google account, which automatically adds email and name
3. SSO when already logged in to Google account
4. Improve confirmation email

### Home page

1. Improve textual descriptions
2. Create a logo

### Common items

1. Do not show fields for entering quantity and units when adding common item

### Item categories

1. Allow creating custom categories per household

### Shopping lists

1. Have a quick-add section per category
2. When selecting an item from quick add, allow entering optional quantity and comment
3. Allow tagging items with a question mark, indicating that we need to check if we already have it
4. Edit quantity for items after generating shopping list
5. When multiple selected meals contain an item, increase the quantity

### Recipes

1. Get new recipe suggestions from AI based on recipe list

## Known bugs

1. On the dashboard, next monday's meal shows up on sunday current week
2. On the settings page, members show up with name "Unknown"
3. After clicking the confirmation link, redirect to dashboard (?)
