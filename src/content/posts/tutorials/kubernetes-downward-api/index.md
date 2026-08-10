---
title: "Kubernetes-Downward API"
published: 2023-10-31
description: "作为 Kubernetes 中最核心的资源对象、最基本的调度单元，可以发现 Pod 中的属性还是非常繁多的，前面使用过一个 volumes 的属性，表示声明一个数据卷，可以通过命令kubectl explain pod.spec.volum"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

作为 Kubernetes 中最核心的资源对象、最基本的调度单元，可以发现 Pod 中的属性还是非常繁多的，前面使用过一个 `volumes` 的属性，表示声明一个数据卷，可以通过命令`kubectl explain pod.spec.volumes`去查看该对象下面的属性非常多，前面只是简单使用了 `hostPath` 和 `emptyDir{}` 这两种模式，其中还有一种模式叫做`downward API`，这个模式和其他模式不一样的地方在于它不是为了存放容器的数据也不是用来进行容器和宿主机的数据交换的，而是让 Pod 里的容器能够直接获取到这个 Pod 对象本身的一些信息。

目前 `Downward API` 提供了两种方式用于将 Pod 的信息注入到容器内部：

- 环境变量：用于单个变量，可以将 Pod 信息和容器信息直接注入容器内部
- Volume 挂载：将 Pod 信息生成为文件，直接挂载到容器内部中去

## 环境变量

通过 `Downward API` 来将 Pod 的 IP、名称以及所对应的 namespace 注入到容器的环境变量中去，然后在容器中打印全部的环境变量来进行验证，对应资源清单文件如下：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: env-pod
  namespce: kube-system
spec:
  containers:
    - name: env-pod
      image: busybox
      command:
        - /bin/sh
        - -c
        - env
      env:
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadate.name
        - name: POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: POD_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

上面使用了一种新的方式来设置 env 的值：`valueFrom`，由于 Pod 的 name 和 namespace 属于元数据，是在 Pod 创建之前就已经定下来了的，所以可以使用 metata 就可以获取到了，但是对于 Pod 的 IP 则不一样，因为 Pod IP 是不固定的，Pod 重建了就变了，它属于状态数据，所以使用 status 这个属性去获取。另外除了使用 `fieldRef`获取 Pod 的基本信息外，还可以通过 `resourceFieldRef` 去获取容器的资源请求和资源限制信息。

创建上面的Pod:

```sh
kubectl apply -f env-pod.yaml
```

```sh
kubectl logs env-pod -n kube-system |grep POD
```

```sh
kubectl logs env-pod -n kube-system
```

![image-20231031110701074](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231031110701074.png)

上面打印 Pod 的环境变量可以看到有很多内置的变量，其中大部分是系统自动添加的，Kubernetes 会把当前命名空间下面的 Service 信息通过环境变量的形式注入到 Pod 中去

## Volume挂载

`Downward API`除了提供环境变量的方式外，还提供了通过 Volume 挂载的方式去获取 Pod 的基本信息。通过`Downward API`将 Pod 的 Label、Annotation 等信息通过 Volume 挂载到容器的某个文件中去，然后在容器中打印出该文件的值来验证，对应的资源清单文件如下所示：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: volume-pod
  namespace: kube-system
  labels:
    k8s-app: test-volume
    node-env: test
  annotations:
    own: tianch
    build: test
spec:
  volumes:
    - name: podinfo
      downwardAPI:
        items:
          - path: labels
            fieldRef:
              fieldPath: namespace.labels
          - path: annotations
            fieldRef:
              fieldPath: metadata.annotations
  containers:
    - name: volume-pod
      image: busybox
      args:
        - sleep
        - "3600"
      volumeMounts:
        - name: podinfo
          mountPath: /etc/podinfo
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

将元数据 labels 和 annotaions 以文件的形式挂载到了 `/etc/podinfo` 目录下，创建上面的 Pod：

```sh
kubectl apply -f volume-pod.yaml
```

创建成功后，进入到容器中查看元信息是不是已经存入到文件中：

```sh
kubectl exec -it volume-pod /bin/sh -n kube-system
```

![image-20231031141338407](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231031141338407.png)

可以看到 Pod 的 Labels 和 Annotations 信息都被挂载到容器的 `/etc/podinfo` 目录下面的 lables 和 annotations 文件了。

目前，`Downward API` 支持的字段已经非常丰富了，比如：

```shell
1. 使用 fieldRef 可以声明使用:

spec.nodeName - 宿主机名字
status.hostIP - 宿主机IP
metadata.name - Pod的名字
metadata.namespace - Pod的Namespace
status.podIP - Pod的IP
spec.serviceAccountName - Pod的Service Account的名字
metadata.uid - Pod的UID
metadata.labels['<KEY>'] - 指定<KEY>的Label值
metadata.annotations['<KEY>'] - 指定<KEY>的Annotation值
metadata.labels - Pod的所有Label
metadata.annotations - Pod的所有Annotation

2. 使用 resourceFieldRef 可以声明使用:

容器的 CPU limit
容器的 CPU request
容器的 memory limit
容器的 memory request
```

需要注意的是，`Downward API` 能够获取到的信息，一定是 Pod 里的容器进程启动之前就能够确定下来的信息。如果想要获取 Pod 容器运行后才会出现的信息，比如，容器进程的 PID，那就肯定不能使用 `Downward API` 了，而应该考虑在 Pod 里定义一个 sidecar 容器来获取了。

在实际应用中，如果应用有获取 Pod 的基本信息的需求，一般可以利用`Downward API`来获取基本信息，然后编写一个启动脚本或者利用`initContainer`将 Pod 的信息注入到容器中去，然后在应用中就可以正常的处理相关逻辑了。

除了通过 Downward API 可以获取到 Pod 本身的信息之外，其实我们还可以通过映射其他资源对象来获取对应的信息，比如 Secret、ConfigMap 资源对象，同样可以通过环境变量和挂载 Volume 的方式来获取它们的信息，但是，通过环境变量获取这些信息的方式，不具备自动更新的能力。所以，一般情况下，都建议使用 Volume 文件的方式获取这些信息，因为通过 Volume 的方式挂载的文件在 Pod 中会进行热更新。

