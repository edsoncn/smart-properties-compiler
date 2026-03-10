# Smart Properties Compiler

Smart Properties Compiler is the language processing component for the Smart Properties SaaS platform. It is responsible for implementing the lexical, syntactic, and semantic analyzers for the Smart Properties Code Language, enabling business logic definitions to be parsed, validated, and transformed into a structured representation.

The semantic analyzer produces a precompiled JSON structure that can be shared to the business aplication with the Smart Properties SDK compiler layer for runtime execution in different environments, including Java and JavaScript. This approach supports consistency across integrations by providing a portable intermediate representation of smart property definitions.

## Goal for This Compiler

Implement the lexical, syntax, and semantic analyzers for the Smart Properties Code Language. The semantic analyzer must generate a precompiled JSON structure that can be shared with the Smart Properties SDK compiler for Java and JavaScript.

## Available Scripts

In the project directory, you can run:

### `npm run build`

Builds the compiler using the TypeScript compiler and outputs the generated artifacts to the configured distribution folder.

### `npm run prepublish`

Runs the build step before publishing the package.

### `npm test`

Runs the current test command placeholder defined in the project.
