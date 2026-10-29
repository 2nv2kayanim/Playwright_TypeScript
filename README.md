# Group Benefits Portal — Playwright Test Framework

## Project introduction

This is a **browser-testing project** for a sample Group Benefits Portal, not the portal product itself. It uses Playwright and TypeScript to check that someone can sign in, see health and dental balances, and submit claims—including checking that claims over the available balance are rejected. A small local mock portal provides the pages and sample data, so tests can run without connecting to a real benefits system. The test scenarios are in [tests/group-benefits.spec.ts](./tests/group-benefits.spec.ts).

The architecture separates responsibilities: [pages/LoginPage.ts](./pages/LoginPage.ts) and [pages/BenefitsPage.ts](./pages/BenefitsPage.ts) hold the page interactions, while [playwright.config.ts](./playwright.config.ts) sets up the browsers, test settings, and local server. The same tests run in Chromium, Firefox, and WebKit. GitHub Actions triggers Jenkins on pushes, same-repository pull requests, and manual runs; fork pull requests run the tests directly in GitHub Actions without secrets: [.github/workflows/jenkins-pipeline.yml](./.github/workflows/jenkins-pipeline.yml) and [Jenkinsfile](./Jenkinsfile).

A strict TypeScript, page-object-based Playwright project demonstrating cross-browser UI coverage for a Group Benefits Portal. The suite covers sign-in, health and dental coverage balances, and both accepted and over-limit claims. Playwright captures traces, screenshots, and videos for failed tests; results are reported in HTML and Allure formats.

## Architecture

```text
.
├── .github/
│   └── workflows/
│       └── jenkins-pipeline.yml
├── Jenkinsfile
├── pages/
│   ├── BenefitsPage.ts
│   └── LoginPage.ts
├── mock-portal/
│   └── server.ts
├── tests/
│   └── group-benefits.spec.ts
├── package.json
├── playwright.config.ts
└── tsconfig.json
```

- **Page objects** keep locators and user actions out of test assertions.
- **Typed fixtures** provide page objects and an authenticated portal page to each test.
- **Browser projects** run the same scenarios in Chromium, Firefox, and WebKit.
- **Diagnostics and reports** include failure-only traces, screenshots, videos, an HTML report, and Allure results.
- **CI** is orchestrated by Jenkins after GitHub Actions triggers the pipeline; Jenkins archives reports and diagnostics. Fork pull requests use a secret-free GitHub Actions test job.
- **Local mock portal** provides a seeded login and benefits UI so the suite runs without an external app.

## Portal contract

By default, Playwright starts the included mock portal at `http://127.0.0.1:3000`. To target a different mock application, set `BENEFITS_PORTAL_URL`; the portal should provide:

- `/login` with accessible labels **Email address** and **Password**, and a **Sign in** button.
- Successful sign-in to navigate to `/benefits`.
- An accessible **Health remaining balance** and **Dental remaining balance** containing currency amounts.
- A **Benefit type** select with `Health` and `Dental` options, **Claim amount** and **Claim description** fields, and a **Submit claim** button.
- A successful submission to display a status message containing “Claim submitted successfully”; an over-limit submission displays an alert mentioning “exceeds” or “limit”.
- A seeded test account with positive health and dental balances. Set its credentials with `BENEFITS_TEST_EMAIL` and `BENEFITS_TEST_PASSWORD`; otherwise the example values `test.user@example.com` and `TestPassword123!` are used.

The included mock server uses the example credentials below and seeded positive health and dental balances. It is intended for local demos and test-framework development, not as a production application.

## Installation

Requirements: Node.js 22+ and npm. Java 17+ is needed only to generate or open the Allure HTML report.

```bash
npm ci
npx playwright install
```

Set the portal URL and test credentials before running (PowerShell example):

```powershell
$env:BENEFITS_PORTAL_URL = "http://127.0.0.1:3000"
$env:BENEFITS_TEST_EMAIL = "test.user@example.com"
$env:BENEFITS_TEST_PASSWORD = "TestPassword123!"
```

If `BENEFITS_PORTAL_URL` is unset, Playwright starts the included server automatically. To start it separately:

```bash
npm run mock:portal
```

The example credentials are for the included local mock only. Use environment variables or your CI secret store for real test environments.

## Running tests

```bash
npm test                    # All configured browsers
npm run test:chromium       # Chromium only
npm run test:firefox        # Firefox only
npm run test:webkit         # WebKit only
npm run test:headed         # Run with visible browser windows
npm run test:ui             # Playwright UI mode
npm run test:debug          # Run in debug mode
npm run typecheck           # Strict TypeScript check
```

The test runner executes projects in headless mode by default and enables parallel execution. In CI it uses four workers and retries failures twice.

## Reports

The HTML report is generated after each run:

```bash
npm run report:html
```

Generate and open the Allure report:

```bash
npm run report:allure
```

Allure's command-line report generator requires Java. `JAVA_HOME` must point to the JDK root directory (the directory containing `bin`), not to its `bin` subdirectory. For example, on Windows use `C:\Program Files\Java\jdk-23`, not `C:\Program Files\Java\jdk-23\bin`. After changing the environment variable, restart the terminal or VS Code so it receives the updated value.

Raw test output and failure diagnostics are written to `test-results/`; the HTML report and Allure files are written to `playwright-report/`, `allure-results/`, and `allure-report/`. Jenkins archives the test outputs in each build.

## Jenkins CI pipeline

GitHub Actions triggers the Jenkins pipeline on every push, pull request from the same repository, and manual `workflow_dispatch` run. The workflow waits for Jenkins to finish and reports the Jenkins build result back to GitHub. Pull requests from forks run the tests directly in GitHub Actions instead; that job uses the local mock and does not access Jenkins credentials.

The Jenkins pipeline checks out the ref that triggered the workflow, installs dependencies and Playwright browsers, runs the strict TypeScript check and all three browser projects, then archives the HTML report, Allure results, and failure diagnostics. Since this repository contains test automation and a mock portal—not a deployable production application—the pipeline does not deploy an application. Jenkins archives the test outputs as its delivery artifacts.

### Jenkins setup

1. Configure a Linux Jenkins agent with Node.js 22, Git, and the Linux system dependencies required by Playwright. Label the agent with both `linux` and `node22`. After checking out the project and running `npm ci`, have an administrator install system dependencies with `npx playwright install-deps`. The pipeline downloads browser binaries as the Jenkins agent user.
2. Ensure Jenkins has the Pipeline and Git plugins, plus the Credentials Binding plugin if you plan to use external portal credentials. The Jenkins account used by GitHub Actions needs permission to build the pipeline and read its queue/build status.
3. Create a Pipeline job named `group-benefits-playwright`, configured to use this repository's `Jenkinsfile`. Define these build parameters on the job: `GITHUB_REPOSITORY` (string), `GITHUB_REF` (string), `GITHUB_READ_CREDENTIALS_ID` (string, default blank), `BENEFITS_PORTAL_URL` (string, default blank), and `USE_EXTERNAL_TEST_CREDENTIALS` (boolean, default false). Jenkins must know these parameters before the first GitHub Actions trigger; add them in the job configuration or run the pipeline once with valid repository and ref values.
4. Create a Jenkins user API token for the account that will be used by GitHub Actions. In the GitHub repository settings, add these Actions secrets:
   - `JENKINS_URL`: Jenkins base URL, such as `https://jenkins.example.com`.
   - `JENKINS_USER`: Jenkins username associated with the API token.
   - `JENKINS_API_TOKEN`: that user's Jenkins API token.
5. Add the Actions repository variable `JENKINS_JOB_PATH` with the job path, such as `job/group-benefits-playwright` (for a job in a folder, use a Jenkins path such as `job/team/job/group-benefits-playwright`).

For a private GitHub repository, create a Jenkins credential with read-only repository access and select it in the Pipeline job's SCM configuration so Jenkins can load the `Jenkinsfile`. Also set the Actions repository variable `GITHUB_READ_CREDENTIALS_ID` to that Jenkins credential ID for the pipeline's source checkout. Public repositories can leave this variable blank.

The pipeline uses the included local mock by default, so no benefits-portal secrets are needed. To test against an external portal, set the Actions repository variable `BENEFITS_PORTAL_URL` to its URL and set `USE_EXTERNAL_TEST_CREDENTIALS` to `true`. In Jenkins, create secret-text credentials with IDs `benefits-test-email` and `benefits-test-password`; the pipeline binds these as environment variables only for the test step. Store real credentials only in Jenkins or GitHub's secret store, never in the workflow or source code.

The Jenkins build archives `playwright-report/`, `allure-results/`, and `test-results/`. Download these from the Jenkins build's **Artifacts** section. Java 17+ is needed only if you later choose to generate an Allure HTML report from the archived results.
