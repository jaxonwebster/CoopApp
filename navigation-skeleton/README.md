# Coop Navigation Skeleton

This small Expo project turns the Coop screen plan into a stack-only navigation skeleton. The screens are intentionally simple stubs; the assignment is focused on app structure and route flow. It uses the Coop colors and the screen groups reflected in the semester project.

## Screen inventory

1. Login
2. Choose Account Type
3. Register
4. Home Dashboard
5. My Chores
6. Chore Details
7. Create or Edit Chore
8. Chore Approvals
9. Missed Chores
10. Family Rewards
11. Create or Edit Reward
12. Active Rewards
13. Quick Cleanup (Home Reset)
14. Family
15. Family Member
16. Profile & History
17. Edit Profile
18. Notification Settings
19. Privacy & Legal

## Run the project

1. Install Node.js and npm if they are not already installed.
2. In this folder, run `npm install`.
3. Run `npx expo start`.
4. Open the QR code with Expo Go, or press `w` to open the web version.

The app opens at **Login**. Tap through account setup to the Home Dashboard. The Home screen’s `+ Chore` header button opens the create chore screen. From Home, use the buttons to reach My Chores, Rewards, Family, and Profile. The remaining screens branch from those main screens. Use each screen’s buttons or the stack back button to return.

## Navigation details

- All 19 screens are registered in one dynamic native stack inside `NavigationContainer`.
- The Home Dashboard is the hub for the main sections. The stack’s back control returns through the route history.
- My Chores passes the ID `chore-001` as `choreId` to Chore Details. Chore Details reads `route.params.choreId` and displays it. Family passes `member-001` as `memberId` to the Family Member screen. Only IDs are passed.
- Header titles share one style set in `screenOptions`. The `+ Chore` header button opens Create or Edit Chore.
- When Coop moves beyond this stack-only lab, Home Dashboard, My Chores, Family Rewards, Family, and Profile & History are good candidates for bottom tabs. The attached assignment diagram marks them as the future tab group.

## Files

- `App.js`: the `NavigationContainer`, native stack, shared header options, and header button.
- `screens/`: one component file per screen plus a shared visual stub wrapper.
- `theme/colors.js`: the Coop palette used by the screen stubs and headers.
- `navigation-diagram.pdf` and `navigation-diagram.png`: one-page navigation diagram.
