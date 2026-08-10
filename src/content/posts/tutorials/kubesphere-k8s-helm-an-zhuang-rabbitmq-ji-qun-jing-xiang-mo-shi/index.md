---
title: "kubesphere+k8s+helm安装RabbitMQ集群+镜像模式"
published: 2022-01-23
description: "使用kubekey安装k8skubesphere 使用此方式会自动安装helm"
tags: ["k8s","RabbitMQ","集群"]
category: "中间件"
draft: false
lang: zh_CN
---

### 1.安装k8s多节点集群

[使用kubekey安装k8skubesphere](http://www.tianch.xyz/archives/%E4%BD%BF%E7%94%A8kubekey%E5%AE%89%E8%A3%85k8skubesphere) 使用此方式会自动安装helm

### 1.下载Rabbitmq的chart包

1. 添加bitnamid仓库

   ```shell
   helm repo add bitnami https://charts.bitnami.com/bitnami
   ```

2. 查询chart

   ```shell
   helm search repo bitnami
   ```

3. 创建rabbitmq的工作目录

   ```shell
   mkdir -p /opt/rabbitmq
   ```

4. 使用helm拉取rabbitmq

   ```shell
   helm pull bitnami/rabbitmq
   ```

5. 解压

   ```shell
   tar -xvf 拉取的文件名-版本变更会导致文件名变化
   ```

### 2.编辑配置文件

1. 设置管理员密码
   - 配置文件方式

     ```yaml
     auth:
       ## @param auth.username RabbitMQ application username
       ## ref: https://github.com/bitnami/bitnami-docker-rabbitmq#environment-variables
       ##
       username: admin

       ## @param auth.password RabbitMQ application password
       ## ref: https://github.com/bitnami/bitnami-docker-rabbitmq#environment-variables
       ##
       password: "77589910"
       ## @param auth.existingPasswordSecret Existing secret with RabbitMQ credentials (must contain a value for `rabbitmq-password` key)
       ## e.g:
       ## existingPasswordSecret: name-of-existing-secret
       ##
       existingPasswordSecret: ""

       ## @param auth.erlangCookie Erlang cookie to determine whether different nodes are allowed to communicate with each other
       ## ref: https://github.com/bitnami/bitnami-docker-rabbitmq#environment-variables
       ##
       erlangCookie: "secretcookie123"
       ## @param auth.existingErlangSecret Existing secret with RabbitMQ Erlang cookie (must contain a value for `rabbitmq-erlang-cookie` key)
       ## e.g:
       ## existingErlangSecret: name-of-existing-secret
       ##
       existingErlangSecret: ""
     ```

     ![image-20220123203354564](https://oss.tianch.xyz/img/image-20220123203354564.png)

   - 安装时set方式指定

     ```shell
     --set auth.username=admin,auth.password=77589910,auth.erlangCookie=secretcookie123
     ```

2. 设置启动副本数

   ```shell
   replicaCount: 3
   ```

   ![image-20220123204103644](https://oss.tianch.xyz/img/image-20220123204103644.png)

3. 设置持久化存储

   ```yaml
   persistence:
     ## @param persistence.enabled Enable RabbitMQ data persistence using PVC
     ##
     enabled: true

     ## @param persistence.storageClass PVC Storage Class for RabbitMQ data volume
     ## If defined, storageClassName: <storageClass>
     ## If set to "-", storageClassName: "", which disables dynamic provisioning
     ## If undefined (the default) or set to null, no storageClassName spec is
     ##   set, choosing the default provisioner.  (gp2 on AWS, standard on
     ##   GKE, AWS & OpenStack)
     ##
     storageClass: "local"
     ## @param persistence.selector Selector to match an existing Persistent Volume
     ## selector:
     ##   matchLabels:
     ##     app: my-app
     ##
     selector: {}
     ## @param persistence.accessMode PVC Access Mode for RabbitMQ data volume
     ##
     accessMode: ReadWriteOnce

     ## @param persistence.existingClaim Provide an existing PersistentVolumeClaims
     ## The value is evaluated as a template
     ## So, for example, the name can depend on .Release or .Chart
     ##
     existingClaim: ""

     ## @param persistence.size PVC Storage Request for RabbitMQ data volume
     ## If you change this value, you might have to adjust `rabbitmq.diskFreeLimit` as well
     ##
     size: 60Gi

     ## @param persistence.volumes Additional volumes without creating PVC
     ##  - name: volume_name
     ##    emptyDir: {}
     ##
     volumes: []
     ## @param persistence.annotations Persistence annotations. Evaluated as a template
     ## Example:
     ## annotations:
     ##   example.io/disk-volume-type: SSD
     ##
     annotations: {}
   ```

   ![image-20220123204323840](https://oss.tianch.xyz/img/image-20220123204323840.png)

4. 设置集群访问方式

   ```yaml
   service:
     ## @param service.type Kubernetes Service type
     ##
     type: NodePort
   ```

   在实操中我发现,如果service.type设置成ClusterIP,等待集群启动完成后,再手动添加NodePort的访问方式,手动删除一个容器后,容器在自动恢复时会报错,然后就是不停的重启

5. 设置集群意外宕机强制重启

   当rabbitmq启用持久化存储时，若rabbitmq所有pod同时宕机，将无法重新启动，因此有必要提前开启`clustering.forceBoot`

   ```shell
   clustering:
     ## @param clustering.enabled Enable RabbitMQ clustering
     ##
     enabled: true
     ## @param clustering.addressType Switch clustering mode. Either `ip` or `hostname`
     ##
     addressType: hostname
     ## @param clustering.rebalance Rebalance master for queues in cluster when new replica is created
     ## ref: https://www.rabbitmq.com/rabbitmq-queues.8.html#rebalance
     ##
     rebalance: false

     ## @param clustering.forceBoot Force boot of an unexpectedly shut down cluster (in an unexpected order).
     ## forceBoot executes 'rabbitmqctl force_boot' to force boot cluster shut down unexpectedly in an unknown order
     ## ref: https://www.rabbitmq.com/rabbitmqctl.8.html#force_boot
     ##
     forceBoot: true

     ## @param clustering.partitionHandling Switch Partition Handling Strategy. Either `autoheal` or `pause-minority` or `pause-if-all-down` or `ignore`
     ## ref: https://www.rabbitmq.com/partitions.html#automatic-handling
     ##
     partitionHandling: autoheal
   ```

   ![image-20220123205045975](https://oss.tianch.xyz/img/image-20220123205045975.png)

6. 指定时区

   ```shell
   extraEnvVars:
     - name: TZ
       value: "Asia/Shanghai"
   ```

### 3.部署RabbitMQ

1. 在kubesphere后台创建命名空间demo-project

   使用kubectl命令创建的在kubesphere后台可能会不显示

2. 安装
   - 使用配置文件中配置的管理员账号密码

     ```shell
     helm install rabbitmq -n demo-project .
     ```

     `helm install`后的`rabbitmq`只是一个名称,起什么名称都可以

     命令最后有一个点

   - 通过set指定管理员账号密码--后期**upgrade**时也须指定上参数

     ```shell
     helm install rabbitmq -n demo-project . \
     --set auth.username=admin,auth.password=77589910,auth.erlangCookie=secretcookie123
     ```

   ![image-20220123205912776](https://oss.tianch.xyz/img/image-20220123205912776.png)

3. 查看安装状态
   - 查看安装进度

     ```shell
     kubectl get pod -n demo-project -w
     ```

     ![image-20220123210139110](https://oss.tianch.xyz/img/image-20220123210139110.png)

   - 查看svc

     ```shell
     kubectl get svc -n demo-project
     ```

   - 查看集群状态
     - 进入pod

       ```shell
       kubectl exec -it -n demo-project rabbitmq-0 -- bash
       ```

     - 查看集群状态

       ```shell
       rabbitmqctl cluster_status
       ```

     - 查看当前策略

       ```shell
       rabbitmqctl list_policies
       ```

     - 设置集群名称

       ```shell
       rabbitmqctl set_cluster_name [cluster_name]
       ```

### 4.配置镜像模式实现高可用

- 使用命令

  ```shell
  rabbitmqctl set_policy ha-all "^" '{"ha-mode":"all" , "ha-sync-mode":"automatic"}'
  ```

- 使用控制台

  ![image-20220121183803914](https://oss.tianch.xyz/img/image-20220121183803914.png)

![image-20220121183850796](https://oss.tianch.xyz/img/image-20220121183850796.png)

### 5.清理RabbitMQ集群

1. 卸载

   ```shell
   helm uninstall rabbitmq -n demo-project
   ```

2. 删除pvc

   ```shell
   kubectl delete pvc -n demo-project data-rabbitmq-0 data-rabbitmq-1 data-rabbitmq-2
   ```

### 6.参考文献

https://blog.csdn.net/qq_14999375/article/details/119085363

