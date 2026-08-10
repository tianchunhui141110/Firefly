---
title: "Kubernetes-Deployment控制器"
published: 2023-10-31
description: "通过前面的 ReplicaSet 控制器，了解到ReplicaSet控制器是用来维护集群中运行的 Pod 数量的，但是往往在实际操作的时候，不会去直接使用 RS，而是会使用更上层的控制器，比如Deployment，Deployment 一个"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

通过前面的 ReplicaSet 控制器，了解到ReplicaSet控制器是用来维护集群中运行的 Pod 数量的，但是往往在实际操作的时候，不会去直接使用 RS，而是会使用更上层的控制器，比如Deployment，Deployment 一个非常重要的功能就是实现了 Pod 的滚动更新，比如应用更新了，只需要更新容器镜像，然后修改 Deployment 里面的 Pod 模板镜像，那么 Deployment 就会用**滚动更新（Rolling Update）**的方式来升级现在的 Pod，这个能力是非常重要的，因为对于线上的服务需要做到不中断服务，所以滚动更新就成了必须的一个功能。而 Deployment 这个能力的实现，依赖的就是 ReplicaSet 这个资源对象，可以通俗的理解就是**每个 Deployment 就对应集群中的一次部署**，这样就更好理解了。

## Deployment概述

Deployment 资源对象的格式和 ReplicaSet 几乎一致，如下资源对象就是一个常见的 Deployment 资源类型：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx
          resources:
            limits:
              memory: "128Mi"
              cpu: "500m"
          ports:
            - containerPort: 80
```

这里只是将类型替换成了 Deployment，先创建下这个资源对象：

```sh
kubectl apply -f nginx-deploy.yaml
```

创建完成后查看Pod状态:

```sh
kubectl get pod -n default -l app=nginx
```

![image-20231031170428299](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231031170428299.png)

到这里发现和之前的 RS 对象似乎没有什么两样，都是根据`spec.replicas`来维持的副本数量，随意查看一个 Pod 的描述信息：

```sh
kubectl describe pod nginx-deployment-67d4bdd6f5-fcjlc -n default
```

```text
Name:         nginx-deployment-67d4bdd6f5-fcjlc
Namespace:    default
Priority:     0
Node:         node3/10.168.1.23
Start Time:   Tue, 31 Oct 2023 17:03:32 +0800
Labels:       app=nginx
              pod-template-hash=67d4bdd6f5
Annotations:  cni.projectcalico.org/containerID: f7f32f957b7738e370941edff7ed5064ab0253287a2b8e237240bb1523a1c4c6
              cni.projectcalico.org/podIP: 10.233.92.110/32
              cni.projectcalico.org/podIPs: 10.233.92.110/32
Status:       Running
IP:           10.233.92.110
IPs:
  IP:           10.233.92.110
Controlled By:  ReplicaSet/nginx-deployment-67d4bdd6f5
Containers:
  nginx:
    Container ID:   containerd://c2e97a02a379cd8f0ec8cad42ca87e25bece7b1fd9de33b07217d89b1a082d97
    Image:          nginx
    Image ID:       docker.io/library/nginx@sha256:add4792d930c25dd2abf2ef9ea79de578097a1c175a16ab25814332fe33622de
    Port:           80/TCP
    Host Port:      0/TCP
    State:          Running
      Started:      Tue, 31 Oct 2023 17:03:35 +0800
    Ready:          True
    Restart Count:  0
    Limits:
      cpu:     500m
      memory:  128Mi
    Requests:
      cpu:        500m
      memory:     128Mi
    Environment:  <none>
    Mounts:
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-2jd4f (ro)
Conditions:
  Type              Status
  Initialized       True
  Ready             True
  ContainersReady   True
  PodScheduled      True
Volumes:
  kube-api-access-2jd4f:
    Type:                    Projected (a volume that contains injected data from multiple sources)
    TokenExpirationSeconds:  3607
    ConfigMapName:           kube-root-ca.crt
    ConfigMapOptional:       <nil>
    DownwardAPI:             true
QoS Class:                   Guaranteed
Node-Selectors:              <none>
Tolerations:                 node.kubernetes.io/not-ready:NoExecute op=Exists for 300s
                             node.kubernetes.io/unreachable:NoExecute op=Exists for 300s
Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  2m6s  default-scheduler  Successfully assigned default/nginx-deployment-67d4bdd6f5-fcjlc to node3
  Normal  Pulling    2m5s  kubelet            Pulling image "nginx"
  Normal  Pulled     2m3s  kubelet            Successfully pulled image "nginx" in 1.923662815s
  Normal  Created    2m3s  kubelet            Created container nginx
  Normal  Started    2m3s  kubelet            Started container nginx

```

仔细查看其中有这样一个信息 `Controlled By: ReplicaSet/nginx-deployment-67d4bdd6f5`，表示当前这个 Pod 的控制器是一个 ReplicaSet 对象，不是创建的一个 Deployment 吗？为什么 Pod 会被 RS 所控制呢？再去看下这个对应的 RS 对象的详细信息如何呢：

```sh
kubectl describe rs nginx-deployment-67d4bdd6f5 -n default
```

```text
Name:           nginx-deployment-67d4bdd6f5
Namespace:      default
Selector:       app=nginx,pod-template-hash=67d4bdd6f5
Labels:         app=nginx
                pod-template-hash=67d4bdd6f5
Annotations:    deployment.kubernetes.io/desired-replicas: 3
                deployment.kubernetes.io/max-replicas: 4
                deployment.kubernetes.io/revision: 1
Controlled By:  Deployment/nginx-deployment
Replicas:       3 current / 3 desired
Pods Status:    3 Running / 0 Waiting / 0 Succeeded / 0 Failed
Pod Template:
  Labels:  app=nginx
           pod-template-hash=67d4bdd6f5
  Containers:
   nginx:
    Image:      nginx
    Port:       80/TCP
    Host Port:  0/TCP
    Limits:
      cpu:        500m
      memory:     128Mi
    Environment:  <none>
    Mounts:       <none>
  Volumes:        <none>
Events:
  Type    Reason            Age   From                   Message
  ----    ------            ----  ----                   -------
  Normal  SuccessfulCreate  5m9s  replicaset-controller  Created pod: nginx-deployment-67d4bdd6f5-wwql8
  Normal  SuccessfulCreate  5m9s  replicaset-controller  Created pod: nginx-deployment-67d4bdd6f5-fcjlc
  Normal  SuccessfulCreate  5m9s  replicaset-controller  Created pod: nginx-deployment-67d4bdd6f5-nd8fl
```

其中有这样的一个信息：`Controlled By: Deployment/nginx-deploy`，意思就是 Pod 依赖的控制器 RS 实际上被 Deployment 控制着，可以用下图来说明 Pod、ReplicaSet、Deployment 三者之间的关系：

![Deployment](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/1662426664683.jpg)

通过上图可以很清楚的看到，定义了 3 个副本的 Deployment 与 ReplicaSet 和 Pod 的关系，就是一层一层进行控制的。ReplicaSet 作用和之前一样还是来保证 Pod 的个数始终保存指定的数量，所以 Deployment 中的容器 `restartPolicy=Always` 是唯一的就是这个原因，因为容器必须始终保证自己处于 Running 状态，ReplicaSet 才可以去明确调整 Pod 的个数。而 Deployment 是通过管理 ReplicaSet 的数量和属性来实现`水平扩展/收缩`以及`滚动更新`两个功能的。

## 水平伸缩

`水平扩展/收缩`的功能比较简单，因为 ReplicaSet 就可以实现，所以 Deployment 控制器只需要去修改它缩控制的 ReplicaSet 的 Pod 副本数量就可以了。比如把 Pod 的副本调整到 4 个，那么 Deployment 所对应的 ReplicaSet 就会自动创建一个新的 Pod 出来，这样就水平扩展了，可以使用一个命令`kubectl scale` 命令来完成这个操作：

```sh
kubectl scale deployment nginx-deployment -n default --replicas=4
```

```sh
kubectl get rs -n default
```

![image-20231031171315023](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231031171315023.png)

## 滚动更新

如果只是`水平扩展/收缩`这两个功能，就完全没必要设计 Deployment 这个资源对象了，Deployment 最突出的一个功能是支持`滚动更新`，比如现在需要把应用容器更改为 `nginx:1.20` 版本，修改后的资源清单文件如下所示：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  minReadySeconds: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.20
          resources:
            limits:
              memory: "128Mi"
              cpu: "500m"
          ports:
            - containerPort: 80
```

```yaml
minReadySeconds: 5
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 1
```

- `minReadySeconds`：表示 Kubernetes 在等待设置的时间后才进行升级，如果没有设置该值，Kubernetes 会假设该容器启动起来后就提供服务了，如果没有设置该值，在某些极端情况下可能会造成服务不正常运行，默认值就是 0。
- `type=RollingUpdate`：表示设置更新策略为滚动更新，可以设置为`Recreate`和`RollingUpdate`两个值，`Recreate`表示全部重新创建，默认值就是`RollingUpdate`。
- `maxSurge`：表示升级过程中最多可以比原先设置多出的 Pod 数量，例如：`maxSurage=1，replicas=5`，就表示 Kubernetes 会先启动一个新的 Pod，然后才删掉一个旧的 Pod，整个升级过程中最多会有`5+1`个 Pod。
- `maxUnavaible`：表示升级过程中最多有多少个 Pod 处于无法提供服务的状态，当`maxSurge`不为 0 时，该值也不能为 0，例如：`maxUnavaible=1`，则表示 Kubernetes 整个升级过程中最多会有 1 个 Pod 处于无法服务的状态。

更新上面的 Deployment 资源对象：可以添加了一个额外的 `--record` 参数来记录下我们的每次操作所执行的命令，以方便后面查看。

```sh
kubectl apply -f nginx-deploy.yaml
```

更新后，可以执行下面的 `kubectl rollout status` 命令来查看我们此次滚动更新的状态

还可以执行如下的命令来暂停更新：

```sh
kubectl rollout pause deployment/nginx-deploy -n default
```

执行下面的命令恢复更新

```sh
kubectl rollout resume deployment/nginx-deploy -n default
```

这个时候我们的滚动更新就暂停了，此时我们可以查看下 Deployment 的详细信息：

```sh
kubectl describe deployment nginx-deployment -n default
```

![image-20231031172846974](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231031172846974.png)

![Deployment RollingUpdate](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/1662426687515.jpg)

仔细观察 Events 事件区域的变化，上面用 `kubectl scale` 命令将 Pod 副本调整到了 4，现在更新的时候是不是声明又变成 3 了，所以 Deployment 控制器首先是将之前控制的 `nginx-deployment-67d4bdd6f5` 这个 RS 资源对象进行缩容操作，然后滚动更新开始了，可以发现 Deployment 为一个新的 `nginx-deployment-7d745cff58` RS 资源对象首先新建了一个新的 Pod，然后将之前的 RS 对象缩容到 2 了，再然后新的 RS 对象扩容到 2，这个过程就是滚动更新的过程，启动一个新的 Pod，杀掉一个旧的 Pod，然后再启动一个新的 Pod，这样滚动更新下去，直到全都变成新的 Pod，这个时候系统中应该存在 4 个 Pod，因为设置的策略`maxSurge=1`，所以在升级过程中是允许的，而且是两个新的 Pod，两个旧的 Pod。

```sh
kubectl get rs -n default
```

![image-20231031173335133](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231031173335133.png)

从上面可以看出滚动更新之前使用的 RS 资源对象的 Pod 副本数已经变成 0 了，而滚动更新后的 RS 资源对象变成了 3 个副本，可以导出之前的 RS 对象查看：

```sh
kubectl get rs nginx-deployment-67d4bdd6f5 -o yaml
```

```text
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  annotations:
    deployment.kubernetes.io/desired-replicas: "3"
    deployment.kubernetes.io/max-replicas: "4"
    deployment.kubernetes.io/revision: "1"
  creationTimestamp: "2023-10-31T09:03:32Z"
  generation: 5
  labels:
    app: nginx
    pod-template-hash: 67d4bdd6f5
  name: nginx-deployment-67d4bdd6f5
  namespace: default
  ownerReferences:
  - apiVersion: apps/v1
    blockOwnerDeletion: true
    controller: true
    kind: Deployment
    name: nginx-deployment
    uid: 2d833e78-bc5f-4f59-9057-028152ee70ce
  resourceVersion: "409993"
  uid: 2c5d1622-1e05-4239-8586-8b6b33e267cf
spec:
  replicas: 0
  selector:
    matchLabels:
      app: nginx
      pod-template-hash: 67d4bdd6f5
  template:
    metadata:
      creationTimestamp: null
      labels:
        app: nginx
        pod-template-hash: 67d4bdd6f5
    spec:
      containers:
      - image: nginx
        imagePullPolicy: Always
        name: nginx
        ports:
        - containerPort: 80
          protocol: TCP
        resources:
          limits:
            cpu: 500m
            memory: 128Mi
        terminationMessagePath: /dev/termination-log
        terminationMessagePolicy: File
      dnsPolicy: ClusterFirst
      restartPolicy: Always
      schedulerName: default-scheduler
      securityContext: {}
      terminationGracePeriodSeconds: 30
status:
  observedGeneration: 5
  replicas: 0
```

仔细观察这个资源对象里面的描述信息除了副本数变成了 `replicas=0` 之外，和更新之前没有什么区别。有了这个 RS 的记录存在，就可以回滚了。而且还可以回滚到前面的任意一个版本，这个版本是如何定义的呢？可以通过命令 `rollout history` 来获取：

```sh
kubectl rollout history deployment nginx-deployment -n default
```

![image-20231031174352623](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231031174352623.png)

其实 `rollout history` 中记录的 `revision` 是和 `ReplicaSets` 一一对应。如果手动删除某个 `ReplicaSet`，对应的`rollout history`就会被删除，也就无法回滚到这个`revison`了，同样还可以查看一个`revison`的详细信息：

```sh
kubectl rollout history deployment nginx-deployment -n default --revision=1
```

![image-20231031174553069](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231031174553069.png)

要直接回退到当前版本的前一个版本，可以直接使用如下命令进行操作：

```sh
kubectl rollout undo deployment nginx-deployment -n default
```

也可以回退到指定的`revision`版本：

```sh
kubectl rollout undo deployment nginx-deployment -n default --to-revision=1
```

回滚的过程中我们同样可以查看回滚状态：

```sh
kubectl rollout status deployment/nginx-deployment -n default
```

![image-20231031174755427](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231031174755427.png)

这个时候查看对应的 RS 资源对象可以看到 Pod 副本已经回到之前的 RS 里面去了:

```sh
kubectl get rs -n default -l app=nginx
```

![image-20231031174829165](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231031174829165.png)

不过需要注意的是回滚的操作滚动的`revision`始终是递增的：

```sh
kubectl rollout history deployment nginx-deployment -n default
```

![image-20231031174939152](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231031174939152.png)

在很早之前的 Kubernetes 版本中，默认情况下会暴露下所有滚动升级的历史记录，也就是 ReplicaSet 对象，但一般情况下没必要保留所有的版本，毕竟会存在 etcd 中，可以通过配置 `spec.revisionHistoryLimit` 属性来设置保留的历史记录数量，不过新版本中该值默认为 10，如果希望多保存几个版本可以设置该字段。

