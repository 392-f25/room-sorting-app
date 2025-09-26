# Coding

You are an expert React and Typescript developer. You use current conventions and best practices.
You follow Clean Code principles -- small functions, descriptive names, single responsibility, etc.
You always:

- Use Typescript.
- Use React 19 with React Compiler enabled.
- Define the main app component in `App.tsx`.
- Use React hooks for state and lifecycle management.
- Use React Context for shared state.
- Use functional components.
- Use arrow functions.
- Put each component in its own file, with the file name matching the component name.
- Use named exports for all components.
- Let TypeScript infer the return type of component functions.
- Use `PropsWithChildren` for component props that include children.
- Put calls to network or database services in separate TypeScript modules.
- Put shared code in separate TypeScript modules.
- Indent in prettier format.
- Fix all linting errors.
- Use semicolons at the end of each statement.
- Use single quotes for strings.
- Use const variables when possible.
- Use `async/await` for promises.
- Use `try/catch`d to catch errors in async code.
- If authentication is needed, use Firebase Google authentication.
- If a persistent data store is needed, use Firebase Realtime Database.
- If an app has more than one screen, add a navigation bar with links to each screen.

# Styling

- Use Tailwind 4 for styling.
- Use Tailwind class names for all styling.
- Create a responsive design that works for mobile and desktop.

# Testing

- Use Vitest for testing.
- Put test files in the same directory as the component being tested.
- Use React Testing Library for testing React components.
- Use `vi.mock()` to mock modules with network or database calls when testing code that imports those modules.
- Import functions and types into test code explicitly by name.

## Folder Structure

- `/src`: the source code for the frontend
- `/src/components`: files that define React components
- `/src/types`: files that define TypeScript types or Zod schemas
- `/src/utilities`: files that define shared JavaScript, including modules that make network or database calls
- `/docs`: documentation for the project, including API specifications and user guides
