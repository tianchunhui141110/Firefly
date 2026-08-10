---
title: "K8S下基于尚医通项目的devops的流水线"
published: 2022-02-19
description: "之所以加上while循环,是因为在弱网环境下容易出现网络闪断导致流水线执行失败"
tags: ["运维"]
category: "其他"
draft: false
lang: zh_CN
---

```shell
pipeline {
  agent {
    node {
      label 'maven'
    }
  }
  stages {

    stage('拉取代码') {
      agent none
      steps {
        container('maven') {
          git(url: 'https://codeup.aliyun.com/6014de608deaa14d9e02ce14/tianch/yygh-parent.git', credentialsId: 'yunxiao-git-id', branch: 'master', changelog: true, poll: false)
          sh 'ls -al'
        }
      }
    }

    stage('项目编译') {
      agent none
      steps {
        container('maven') {
          sh 'ls -al'
          sh 'mvn clean package -Dmaven.test.skip=true'
        }
      }
    }

    stage('构建镜像') {
      parallel {
        stage('构建hospital-manage镜像') {
          agent none
          steps {
            container('maven') {
              sh 'ls hospital-manage/target'
              sh 'docker build -t hospital-manage:latest -f hospital-manage/Dockerfile  ./hospital-manage/'
            }
          }
        }

        stage('构建server-gateway镜像') {
          agent none
          steps {
            container('maven') {
              sh 'ls server-gateway/target'
              sh 'docker build -t server-gateway:latest -f server-gateway/Dockerfile  ./server-gateway/'
            }
          }
        }

        stage('构建service-cmn镜像') {
          agent none
          steps {
            container('maven') {
              sh 'ls service/service-cmn/target'
              sh 'docker build -t service-cmn:latest -f service/service-cmn/Dockerfile  ./service/service-cmn/'
            }

          }
        }

        stage('构建service-hosp镜像') {
          agent none
          steps {
            container('maven') {
              sh 'ls service/service-hosp/target'
              sh 'docker build -t service-hosp:latest -f service/service-hosp/Dockerfile  ./service/service-hosp/'
            }

          }
        }

        stage('构建service-order镜像') {
          agent none
          steps {
            container('maven') {
              sh 'ls service/service-order/target'
              sh 'docker build -t service-order:latest -f service/service-order/Dockerfile  ./service/service-order/'
            }

          }
        }

        stage('构建service-oss镜像') {
          agent none
          steps {
            container('maven') {
              sh 'ls service/service-oss/target'
              sh 'docker build -t service-oss:latest -f service/service-oss/Dockerfile  ./service/service-oss/'
            }

          }
        }

        stage('构建service-sms镜像') {
          agent none
          steps {
            container('maven') {
              sh 'ls service/service-sms/target'
              sh 'docker build -t service-sms:latest -f service/service-sms/Dockerfile  ./service/service-sms/'
            }

          }
        }

        stage('构建service-statistics镜像') {
          agent none
          steps {
            container('maven') {
              sh 'ls service/service-statistics/target'
              sh 'docker build -t service-statistics:latest -f service/service-statistics/Dockerfile  ./service/service-statistics/'
            }

          }
        }

        stage('构建service-task镜像') {
          agent none
          steps {
            container('maven') {
              sh 'ls service/service-task/target'
              sh 'docker build -t service-task:latest -f service/service-task/Dockerfile  ./service/service-task/'
            }

          }
        }

        stage('构建service-user镜像') {
          agent none
          steps {
            container('maven') {
              sh 'ls service/service-user/target'
              sh 'docker build -t service-user:latest -f service/service-user/Dockerfile  ./service/service-user/'
            }

          }
        }

      }
    }

    stage('推送镜像') {
      parallel {
        stage('推送hospital-manage镜像') {
          agent none
          steps {
            container('maven') {
              withCredentials([usernamePassword(credentialsId : 'harbor-docker-registry' ,usernameVariable : 'DOCKER_USER_VAR' ,passwordVariable : 'DOCKER_PWD_VAR' ,)]) {
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo ".................. docker login begin  ..................."

    echo "$DOCKER_PWD_VAR" | docker login $REGISTRY_URL -u "$DOCKER_USER_VAR" --password-stdin
    # check and retry

    if [ $? -eq 0 ]; then
        echo "--------------- docker login complete ---------------"
        break;
    else
        echo "...............docker login error, retry in 2 seconds .........."
        sleep 2
    fi
done'''
                sh 'docker tag hospital-manage:latest $REGISTRY/$DOCKERHUB_NAMESPACE/hospital-manage:SNAPSHOT-$BUILD_NUMBER'
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo ".................. docker push begin  ..................."

    docker push  $REGISTRY/$DOCKERHUB_NAMESPACE/hospital-manage:SNAPSHOT-$BUILD_NUMBER
    # check and retry

    if [ $? -eq 0 ]; then
        echo "---------------  docker push complete ---------------"
        break;
    else
        echo "............... docker push error occur, retry in 2 seconds .........."
        sleep 2
    fi
done
echo "success"'''
              }

            }

          }
        }

        stage('推送server-gateway镜像') {
          agent none
          steps {
            container('maven') {
              withCredentials([usernamePassword(credentialsId : 'harbor-docker-registry' ,usernameVariable : 'DOCKER_USER_VAR' ,passwordVariable : 'DOCKER_PWD_VAR' ,)]) {
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo ".................. docker login begin  ..................."

    echo "$DOCKER_PWD_VAR" | docker login $REGISTRY_URL -u "$DOCKER_USER_VAR" --password-stdin
    # check and retry

    if [ $? -eq 0 ]; then
        echo "--------------- docker login complete ---------------"
        break;
    else
        echo "...............docker login error, retry in 2 seconds .........."
        sleep 2
    fi
done'''
                sh 'docker tag server-gateway:latest $REGISTRY/$DOCKERHUB_NAMESPACE/server-gateway:SNAPSHOT-$BUILD_NUMBER'
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo "..................  docker push begin  ..................."

    docker push  $REGISTRY/$DOCKERHUB_NAMESPACE/server-gateway:SNAPSHOT-$BUILD_NUMBER
    # check and retry

    if [ $? -eq 0 ]; then
        echo "---------------  docker push complete ---------------"
        break;
    else
        echo "............... docker push error occur, retry in 2 seconds .........."
        sleep 2
    fi
done
echo "success"'''
              }

            }

          }
        }

        stage('推送service-cmn镜像') {
          agent none
          steps {
            container('maven') {
              withCredentials([usernamePassword(credentialsId : 'harbor-docker-registry' ,usernameVariable : 'DOCKER_USER_VAR' ,passwordVariable : 'DOCKER_PWD_VAR' ,)]) {
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo ".................. docker login begin  ..................."

    echo "$DOCKER_PWD_VAR" | docker login $REGISTRY_URL -u "$DOCKER_USER_VAR" --password-stdin
    # check and retry

    if [ $? -eq 0 ]; then
        echo "--------------- docker login complete ---------------"
        break;
    else
        echo "...............docker login error, retry in 2 seconds .........."
        sleep 2
    fi
done'''
                sh 'docker tag service-cmn:latest $REGISTRY/$DOCKERHUB_NAMESPACE/service-cmn:SNAPSHOT-$BUILD_NUMBER'
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo "..................  docker push begin  ..................."

    docker push  $REGISTRY/$DOCKERHUB_NAMESPACE/service-cmn:SNAPSHOT-$BUILD_NUMBER
    # check and retry

    if [ $? -eq 0 ]; then
        echo "---------------  docker push complete ---------------"
        break;
    else
        echo "............... docker push error occur, retry in 2 seconds .........."
        sleep 2
    fi
done
echo "success"'''
              }

            }

          }
        }

        stage('推送service-hosp镜像') {
          agent none
          steps {
            container('maven') {
              withCredentials([usernamePassword(credentialsId : 'harbor-docker-registry' ,usernameVariable : 'DOCKER_USER_VAR' ,passwordVariable : 'DOCKER_PWD_VAR' ,)]) {
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo ".................. docker login begin  ..................."

    echo "$DOCKER_PWD_VAR" | docker login $REGISTRY_URL -u "$DOCKER_USER_VAR" --password-stdin
    # check and retry

    if [ $? -eq 0 ]; then
        echo "--------------- docker login complete ---------------"
        break;
    else
        echo "...............docker login error, retry in 2 seconds .........."
        sleep 2
    fi
done'''
                sh 'docker tag service-hosp:latest $REGISTRY/$DOCKERHUB_NAMESPACE/service-hosp:SNAPSHOT-$BUILD_NUMBER'
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo "..................  docker push begin  ..................."

    docker push  $REGISTRY/$DOCKERHUB_NAMESPACE/service-hosp:SNAPSHOT-$BUILD_NUMBER
    # check and retry

    if [ $? -eq 0 ]; then
        echo "---------------  docker push complete ---------------"
        break;
    else
        echo "............... docker push error occur, retry in 2 seconds .........."
        sleep 2
    fi
done
echo "success"'''
              }

            }

          }
        }

        stage('推送service-order镜像') {
          agent none
          steps {
            container('maven') {
              withCredentials([usernamePassword(credentialsId : 'harbor-docker-registry' ,usernameVariable : 'DOCKER_USER_VAR' ,passwordVariable : 'DOCKER_PWD_VAR' ,)]) {
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo ".................. docker login begin  ..................."

    echo "$DOCKER_PWD_VAR" | docker login $REGISTRY_URL -u "$DOCKER_USER_VAR" --password-stdin
    # check and retry

    if [ $? -eq 0 ]; then
        echo "--------------- docker login complete ---------------"
        break;
    else
        echo "...............docker login error, retry in 2 seconds .........."
        sleep 2
    fi
done'''
                sh 'docker tag service-order:latest $REGISTRY/$DOCKERHUB_NAMESPACE/service-order:SNAPSHOT-$BUILD_NUMBER'
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo "..................  docker push begin  ..................."

    docker push  $REGISTRY/$DOCKERHUB_NAMESPACE/service-order:SNAPSHOT-$BUILD_NUMBER
    # check and retry

    if [ $? -eq 0 ]; then
        echo "---------------  docker push complete ---------------"
        break;
    else
        echo "............... docker push error occur, retry in 2 seconds .........."
        sleep 2
    fi
done
echo "success"'''
              }

            }

          }
        }

        stage('推送service-oss镜像') {
          agent none
          steps {
            container('maven') {
              withCredentials([usernamePassword(credentialsId : 'harbor-docker-registry' ,usernameVariable : 'DOCKER_USER_VAR' ,passwordVariable : 'DOCKER_PWD_VAR' ,)]) {
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo ".................. docker login begin  ..................."

    echo "$DOCKER_PWD_VAR" | docker login $REGISTRY_URL -u "$DOCKER_USER_VAR" --password-stdin
    # check and retry

    if [ $? -eq 0 ]; then
        echo "--------------- docker login complete ---------------"
        break;
    else
        echo "...............docker login error, retry in 2 seconds .........."
        sleep 2
    fi
done'''
                sh 'docker tag service-oss:latest $REGISTRY/$DOCKERHUB_NAMESPACE/service-oss:SNAPSHOT-$BUILD_NUMBER'
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo "..................  docker push begin  ..................."

    docker push  $REGISTRY/$DOCKERHUB_NAMESPACE/service-oss:SNAPSHOT-$BUILD_NUMBER
    # check and retry

    if [ $? -eq 0 ]; then
        echo "---------------  docker push complete ---------------"
        break;
    else
        echo "............... docker push error occur, retry in 2 seconds .........."
        sleep 2
    fi
done
echo "success"'''
              }

            }

          }
        }

        stage('推送service-sms镜像') {
          agent none
          steps {
            container('maven') {
              withCredentials([usernamePassword(credentialsId : 'harbor-docker-registry' ,usernameVariable : 'DOCKER_USER_VAR' ,passwordVariable : 'DOCKER_PWD_VAR' ,)]) {
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo ".................. docker login begin  ..................."

    echo "$DOCKER_PWD_VAR" | docker login $REGISTRY_URL -u "$DOCKER_USER_VAR" --password-stdin
    # check and retry

    if [ $? -eq 0 ]; then
        echo "--------------- docker login complete ---------------"
        break;
    else
        echo "...............docker login error, retry in 2 seconds .........."
        sleep 2
    fi
done'''
                sh 'docker tag service-sms:latest $REGISTRY/$DOCKERHUB_NAMESPACE/service-sms:SNAPSHOT-$BUILD_NUMBER'
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo "..................  docker push begin  ..................."

    docker push  $REGISTRY/$DOCKERHUB_NAMESPACE/service-sms:SNAPSHOT-$BUILD_NUMBER
    # check and retry

    if [ $? -eq 0 ]; then
        echo "---------------  docker push complete ---------------"
        break;
    else
        echo "............... docker push error occur, retry in 2 seconds .........."
        sleep 2
    fi
done
echo "success"'''
              }

            }

          }
        }

        stage('推送service-statistics镜像') {
          agent none
          steps {
            container('maven') {
              withCredentials([usernamePassword(credentialsId : 'harbor-docker-registry' ,usernameVariable : 'DOCKER_USER_VAR' ,passwordVariable : 'DOCKER_PWD_VAR' ,)]) {
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo ".................. docker login begin  ..................."

    echo "$DOCKER_PWD_VAR" | docker login $REGISTRY_URL -u "$DOCKER_USER_VAR" --password-stdin
    # check and retry

    if [ $? -eq 0 ]; then
        echo "--------------- docker login complete ---------------"
        break;
    else
        echo "...............docker login error, retry in 2 seconds .........."
        sleep 2
    fi
done'''
                sh 'docker tag service-statistics:latest $REGISTRY/$DOCKERHUB_NAMESPACE/service-statistics:SNAPSHOT-$BUILD_NUMBER'
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo "..................  docker push begin  ..................."

    # ...... call your command here 在这里调用你的命令 ......
    docker push  $REGISTRY/$DOCKERHUB_NAMESPACE/service-statistics:SNAPSHOT-$BUILD_NUMBER
    # check and retry

    if [ $? -eq 0 ]; then
        echo "---------------  docker push complete ---------------"
        break;
    else
        echo "............... docker push error occur, retry in 2 seconds .........."
        sleep 2
    fi
done
echo "success"'''
              }

            }

          }
        }

        stage('推送service-task镜像') {
          agent none
          steps {
            container('maven') {
              withCredentials([usernamePassword(credentialsId : 'harbor-docker-registry' ,usernameVariable : 'DOCKER_USER_VAR' ,passwordVariable : 'DOCKER_PWD_VAR' ,)]) {
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo ".................. docker login begin  ..................."

    echo "$DOCKER_PWD_VAR" | docker login $REGISTRY_URL -u "$DOCKER_USER_VAR" --password-stdin
    # check and retry

    if [ $? -eq 0 ]; then
        echo "--------------- docker login complete ---------------"
        break;
    else
        echo "...............docker login error, retry in 2 seconds .........."
        sleep 2
    fi
done'''
                sh 'docker tag service-task:latest $REGISTRY/$DOCKERHUB_NAMESPACE/service-task:SNAPSHOT-$BUILD_NUMBER'
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo "..................  docker push begin  ..................."

    docker push  $REGISTRY/$DOCKERHUB_NAMESPACE/service-task:SNAPSHOT-$BUILD_NUMBER
    # check and retry

    if [ $? -eq 0 ]; then
        echo "---------------  docker push complete ---------------"
        break;
    else
        echo "............... docker push error occur, retry in 2 seconds .........."
        sleep 2
    fi
done
echo "success"'''
              }

            }

          }
        }

        stage('推送service-user镜像') {
          agent none
          steps {
            container('maven') {
              withCredentials([usernamePassword(credentialsId : 'harbor-docker-registry' ,usernameVariable : 'DOCKER_USER_VAR' ,passwordVariable : 'DOCKER_PWD_VAR' ,)]) {
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo ".................. docker login begin  ..................."

    echo "$DOCKER_PWD_VAR" | docker login $REGISTRY_URL -u "$DOCKER_USER_VAR" --password-stdin
    # check and retry

    if [ $? -eq 0 ]; then
        echo "--------------- docker login complete ---------------"
        break;
    else
        echo "...............docker login error, retry in 2 seconds .........."
        sleep 2
    fi
done'''
                sh 'docker tag service-user:latest $REGISTRY/$DOCKERHUB_NAMESPACE/service-user:SNAPSHOT-$BUILD_NUMBER'
                sh '''#!/bin/sh
while [ 0 -eq 0 ]
do
    echo "..................  docker push begin  ..................."

    docker push  $REGISTRY/$DOCKERHUB_NAMESPACE/service-user:SNAPSHOT-$BUILD_NUMBER
    # check and retry

    if [ $? -eq 0 ]; then
        echo "---------------  docker push complete ---------------"
        break;
    else
        echo "............... docker push error occur, retry in 2 seconds .........."
        sleep 2
    fi
done
echo "success"'''
              }

            }

          }
        }

      }
    }
  }
  environment {
    DOCKER_CREDENTIAL_ID = 'dockerhub-id'
    GITHUB_CREDENTIAL_ID = 'github-id'
    KUBECONFIG_CREDENTIAL_ID = 'demo-kubeconfig'
    REGISTRY_URL = 'harbor.tianch.xyz'
    REGISTRY = 'harbor.tianch.xyz'
    DOCKERHUB_NAMESPACE = 'tianch'
    GITHUB_ACCOUNT = 'kubesphere'
    APP_NAME = 'devops-java-sample'
  }
  parameters {
    string(name: 'TAG_NAME', defaultValue: '', description: '')
  }
}
```

之所以加上while循环,是因为在弱网环境下容易出现网络闪断导致流水线执行失败

注意:此流水线还未加上部署到k8s的stage;流水线中的一些参数取值一部分来自环境变量,另一部分需要在kubesphere后台添加(或者使用k8s的命令添加)

