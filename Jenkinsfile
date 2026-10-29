pipeline {
  agent {
    label 'linux && node22'
  }

  options {
    skipDefaultCheckout(true)
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 40, unit: 'MINUTES')
  }

  parameters {
    string(name: 'GITHUB_REPOSITORY', defaultValue: '', description: 'Repository in owner/name format')
    string(name: 'GITHUB_REF', defaultValue: '', description: 'Git ref supplied by the GitHub Actions workflow')
    string(name: 'GITHUB_READ_CREDENTIALS_ID', defaultValue: '', description: 'Optional Jenkins credential ID for a private GitHub repository')
    string(name: 'BENEFITS_PORTAL_URL', defaultValue: '', description: 'Optional external portal URL; blank uses the local mock')
    booleanParam(name: 'USE_EXTERNAL_TEST_CREDENTIALS', defaultValue: false, description: 'Use the Jenkins credentials benefits-test-email and benefits-test-password')
  }

  environment {
    CI = 'true'
    BENEFITS_PORTAL_URL = "${params.BENEFITS_PORTAL_URL}"
  }

  stages {
    stage('Validate trigger') {
      steps {
        script {
          if (!(params.GITHUB_REPOSITORY ==~ /[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/)) {
            error('GITHUB_REPOSITORY must use the owner/name format.')
          }

          if (!(params.GITHUB_REF.startsWith('refs/heads/') || params.GITHUB_REF ==~ /refs\/pull\/[0-9]+\/merge/)) {
            error('GITHUB_REF must be a branch ref or a GitHub pull-request merge ref.')
          }
        }
      }
    }

    stage('Checkout source') {
      steps {
        deleteDir()
        script {
          def remote = [
            url: "https://github.com/${params.GITHUB_REPOSITORY}.git",
            refspec: "+${params.GITHUB_REF}:refs/remotes/origin/jenkins-build"
          ]
          if (params.GITHUB_READ_CREDENTIALS_ID?.trim()) {
            remote.credentialsId = params.GITHUB_READ_CREDENTIALS_ID.trim()
          }

          checkout([
            $class: 'GitSCM',
            branches: [[name: '*/jenkins-build']],
            userRemoteConfigs: [remote]
          ])
        }
      }
    }

    stage('Install dependencies') {
      steps {
        sh 'npm ci'
        sh 'npx playwright install'
      }
    }

    stage('Type check') {
      steps {
        sh 'npm run typecheck'
      }
    }

    stage('Run cross-browser tests') {
      steps {
        script {
          if (params.USE_EXTERNAL_TEST_CREDENTIALS) {
            withCredentials([
              string(credentialsId: 'benefits-test-email', variable: 'BENEFITS_TEST_EMAIL'),
              string(credentialsId: 'benefits-test-password', variable: 'BENEFITS_TEST_PASSWORD')
            ]) {
              sh 'npx playwright test'
            }
          } else {
            sh 'npx playwright test'
          }
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts(
        artifacts: 'playwright-report/**,allure-results/**,test-results/**',
        allowEmptyArchive: true
      )
    }
  }
}
