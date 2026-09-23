# Project Description: Closet — AI-Powered Wardrobe & Outfit Assistant

## One-line pitch
A mobile app that lets users digitize their wardrobe, plan outfits, get AI-driven styling suggestions, and track items they want to buy — turning a closet full of clothes into a searchable, smart personal styling tool.

## Problem statement
Most people own more clothing than they actively wear, largely because they can't easily see everything they own, remember what pairs well together, or plan outfits ahead of time. Existing wardrobe apps are either purely inventory-based (digital closets with no intelligence) or purely inspirational (mood boards with no connection to what a user actually owns). There's a gap for a tool that combines an accurate digital catalog of a user's real wardrobe with AI-generated, personalized styling recommendations.

## Target user
College students and young professionals who want to get more mileage out of their existing wardrobe, reduce decision fatigue when getting dressed, and shop more intentionally instead of impulsively.

## Core features (MVP)
1. **Digital closet catalog** — Users photograph or upload clothing items; the app auto-tags each item by category (T-shirts, shirts, sweatshirts, hoodies, pants, formal pants, shoes, hats, accessories, etc.), color, and season using AI vision, with manual edit/override. Closet view is browsable/filterable by category.
2. **Daily auto-generated outfit** — Each day, the app generates a complete outfit from the user's existing wardrobe based on local weather (temperature, precipitation), the user's established style preferences, and what's realistically available (clean/unworn recently, season-appropriate).
3. **Event-based outfit requests** — Users can prompt the app for an outfit suited to a specific occasion (e.g. "meeting with my boss," "interview," "golf outing," "gym") and get a tailored suggestion pulled from their own closet.
4. **Save favorite outfits** — Any generated outfit (daily or event-based) can be saved to a personal collection for reuse later.
5. **Wardrobe gap-finder / shopping suggestions** — The app identifies likely gaps in the user's wardrobe (e.g. "you don't have a plain white tee") and surfaces real products that fill the gap, filtered by the user's budget and brand preferences, and informed by current clothing trends.
6. **Polished UI/UX** — Clean, modern visual design with thoughtful transitions/animations (outfit reveal, category browsing, save actions) — this is a first-class requirement, not an afterthought.

## Stretch features (post-MVP, if time allows)
- "Cost per wear" tracking to visualize wardrobe usage over time
- Packing list generator for trips based on weather + duration
- Social sharing of outfits with friends
- Laundry/wear-frequency tracking to surface neglected items

## Recommended tech stack
| Layer | Choice | Why |
|---|---|---|
| Mobile frontend | React Native + Expo, TypeScript | Single codebase for iOS & Android; fast iteration; huge ecosystem |
| Backend API | Node.js + Express (or Next.js API routes) | Widely recognized, pairs cleanly with TS frontend |
| Database | PostgreSQL + Prisma ORM | Relational data (users, items, categories, outfits, saved outfits) fits well; Prisma keeps schema/migrations clean |
| Image storage | Cloudinary or AWS S3 | Handles resizing/CDN delivery of clothing photos |
| AI vision & tagging | Claude API (vision) | Auto-categorizes and tags uploaded clothing photos |
| Outfit generation logic | Claude API (text) | Given wardrobe inventory + weather + occasion + style history, generates outfit picks with reasoning |
| Weather data | OpenWeatherMap API (or similar) | Powers the daily auto-generated outfit |
| Product discovery for gap-finding | Product search / shopping APIs (e.g. Google Shopping API, or an affiliate network like Rakuten Advertising / Skimlinks) | More reliable and legally sound than scraping retailer sites directly — those tend to break on redesigns and often violate ToS |
| Auth | Clerk or Firebase Auth | Fast to integrate, handles the security bits you don't want to hand-roll |
| Animation | React Native Reanimated + Moti | Smooth, performant transitions without fighting the RN animation API directly |

## Why this project works well for a resume
- Demonstrates full-stack mobile development (not just a web CRUD app)
- Involves real database design (users, items, outfits, many-to-many relationships)
- Integrates a modern AI API in a genuinely useful (not gimmicky) way
- Has a clear, scoped MVP you can actually finish, plus stretch goals to keep expanding if you have more time

## Suggested build order
1. Set up React Native/Expo project + backend skeleton + Postgres schema
2. Auth + basic navigation
3. Closet catalog: photo upload → AI tagging by category → manual edit → browsable/filterable item views
4. Weather integration + daily auto-generated outfit
5. Event-based outfit prompt (text input → tailored outfit from closet)
6. Save-outfit feature
7. Wardrobe gap-finder: identify missing staples → surface real products via shopping API, filtered by budget/brand
8. UI/UX polish pass: animations, transitions, empty states, onboarding
9. (Stretch features if time allows)
