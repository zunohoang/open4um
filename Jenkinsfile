pipeline {
  agent {
    label 'linux && node24'
  }

  tools {
    nodejs 'nodejs-24'
  }

  options {
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
    disableConcurrentBuilds(abortPrevious: true)
    skipDefaultCheckout(true)
    timeout(time: 20, unit: 'MINUTES')
    timestamps()
  }

  environment {
    CI = 'true'
    NPM_CONFIG_AUDIT = 'false'
    NPM_CONFIG_FUND = 'false'
  }

  stages {
    stage('Checkout') {
      steps {
        deleteDir()
        checkout scm
      }
    }

    stage('Validate CI Context') {
      steps {
        script {
          def targetBranch = env.CHANGE_ID ? env.CHANGE_TARGET : env.BRANCH_NAME
          if (!['develop', 'main'].contains(targetBranch)) {
            error("CI is restricted to develop/main; received ${targetBranch}")
          }
        }

        sh '''
          set -eu
          test "$(id -un)" = "jenkins-agent"
          test ! -r /var/lib/jenkins/secrets/master.key
          test "$(node --version)" = "v24.21.0"
          test "$(npm --version)" = "11.19.0"
          printf 'node=%s npm=%s agent=%s user=%s\n' \
            "$(node --version)" \
            "$(npm --version)" \
            "$NODE_NAME" \
            "$(id -un)"
        '''
      }
    }

    stage('Install Backend Dependencies') {
      steps {
        dir('server') {
          sh 'npm ci --no-audit --no-fund'
        }
      }
    }

    stage('Backend Unit Tests') {
      steps {
        dir('server') {
          sh 'npm run test:unit:ci'
        }
      }
    }
  }

  post {
    always {
      junit allowEmptyResults: true,
        testResults: 'server/reports/junit/server-unit.xml'
      archiveArtifacts allowEmptyArchive: true,
        artifacts: 'server/coverage/**'
      deleteDir()
    }
  }
}
