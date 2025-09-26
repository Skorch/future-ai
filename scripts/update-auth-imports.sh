#!/bin/bash

# Find and update all files with NextAuth imports
echo "Updating auth imports from NextAuth to Clerk..."

# Update import statements
find app lib components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "from '@/app/(auth)/auth'" {} \; | while read file; do
  echo "Updating: $file"
  # Replace the import
  sed -i '' "s|from '@/app/(auth)/auth'|from '@clerk/nextjs/server'|g" "$file"

  # Update session usage patterns
  sed -i '' "s|const session = await auth()|const { userId } = await auth()|g" "$file"
  sed -i '' "s|if (!session?.user)|if (!userId)|g" "$file"
  sed -i '' "s|session\.user\.id|userId|g" "$file"
  sed -i '' "s|session\.user\.email|userId|g" "$file"
done

echo "Auth imports updated!"