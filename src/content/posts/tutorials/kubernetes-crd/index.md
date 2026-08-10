---
title: "Kubernetes-CRD"
published: 2026-01-05
description: "Custom Resource Define 简称 CRD，是 Kubernetes（v1.7+）为提高可扩展性，让开发者去自定义资源的一种方式。CRD 资源可以动态注册到集群中，注册完毕后，用户可以通过 kubectl 来创建访问这个自定"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

`Custom Resource Define` 简称 CRD，是 Kubernetes（v1.7+）为提高可扩展性，让开发者去自定义资源的一种方式。CRD 资源可以动态注册到集群中，注册完毕后，用户可以通过 kubectl 来创建访问这个自定义的资源对象，类似于操作 Pod 一样。不过需要注意的是 CRD 仅仅是资源的定义而已，需要一个 Controller 去监听 CRD 的各种事件来添加自定义的业务逻辑。

## 定义

如果说只是对 CRD 资源本身进行 CRUD 操作的话，不需要 Controller 也是可以实现的，相当于就是只有数据存入了 etcd 中，而没有对这个数据的相关操作而已。比如可以定义一个如下所示的 CRD 资源清单文件：_crd-demo.yaml_

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  # name 必须匹配下面的spec字段：<plural>.<group>
  name: crontabs.stable.example.com
spec:
  # group 名用于 REST API 中的定义：/apis/<group>/<version>
  group: stable.example.com
  # 列出自定义资源的所有 API 版本
  versions:
    - name: v1beta1 # 版本名称，比如 v1、v2beta1 等等
      served: true # 是否开启通过 REST APIs 访问 `/apis/<group>/<version>/...`
      storage: true # 必须将一个且只有一个版本标记为存储版本
      schema: # 定义自定义对象的声明规范
        openAPIV3Schema:
          description: Define CronTab YAML Spec
          type: object
          properties:
            spec:
              type: object
              properties:
                cronSpec:
                  type: string
                image:
                  type: string
                replicas:
                  type: integer
  # 定义作用范围：Namespaced（命名空间级别）或者 Cluster（整个集群）
  scope: Namespaced
  names:
    # kind 是 sigular 的一个驼峰形式定义，在资源清单中会使用
    kind: CronTab
    # plural 名字用于 REST API 中的定义：/apis/<group>/<version>/<plural>
    plural: crontabs
    # singular 名称用于 CLI 操作或显示的一个别名
    singular: crontab
    # shortNames 相当于缩写形式
    shortNames:
      - ct
```

这个地方的定义和定义普通的资源对象比较类似，可以随意定义一个自定义的资源对象，但是在创建资源的时候，肯定不是随意去编写 YAML 文件的，当把上面的 CRD 文件提交给 Kubernetes 之后，Kubernetes 会对提交的声明文件进行校验，从定义可以看出 CRD 是基于 [OpenAPI v3 schem](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#schemaObject) 进行规范的。当然这种校验只是对于字段的类型进行校验，比较初级，如果想要更加复杂的校验，这个时候就需要通过 Kubernetes 的 admission webhook 来实现了。关于校验的更多用法，可以前往[官方文档](https://kubernetes.io/docs/tasks/access-kubernetes-api/custom-resources/custom-resource-definitions/#validation)查看。

同样现在我们可以直接使用 kubectl 来创建这个 CRD 资源清单：

```sh
kubectl apply -f crd-demo.yaml
```

![image-20231102182137026](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231102182137026.png)

这个时候一个新的 namespace 级别的 RESTful API 就会被创建：

```sh
/apis/stable/example.com/v1beta1/namespaces/*/crontabs/...
```

然后就可以使用这个 API 端点来创建和管理自定义的对象，这些对象的类型就是上面创建的 CRD 对象规范中的 `CronTab`。

现在在 Kubernetes 集群中就多了一种新的资源叫做 `crontabs.stable.example.com`，可以使用它来定义一个 `CronTab` 资源对象了，这个自定义资源对象里面可以包含的字段在定义的时候通过 `schema` 进行了规范，比如现在创建一个如下所示的资源清单：_crd-crontab-demo.yaml_

```yaml
apiVersion: stable.example.com/v1beta1
kind: CronTab
metadata:
  name: my-new-cron-object
spec:
  cronSpec: "* * * * */5"
  image: my-awesome-cron-image
```

直接创建这个对象：

```sh
kubectl apply -f crd-crontab-demo.yaml
```

![image-20231102182642342](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231102182642342.png)

在使用 kubectl 的时候，资源名称是不区分大小写的，可以使用 CRD 中定义的单数或者复数形式以及任何简写。也可以查看创建的这个对象的原始 YAML 数据：

```sh
kubectl get ct -o yaml
```

```yaml
apiVersion: v1
items:
  - apiVersion: stable.example.com/v1beta1
    kind: CronTab
    metadata:
      annotations:
        kubectl.kubernetes.io/last-applied-configuration: |
          {"apiVersion":"stable.example.com/v1beta1","kind":"CronTab","metadata":{"annotations":{},"name":"my-new-cron-object","namespace":"default"},"spec":{"cronSpec":"* * * * */5","image":"my-awesome-cron-image"}}
      creationTimestamp: "2023-11-02T10:26:09Z"
      generation: 1
      name: my-new-cron-object
      namespace: default
      resourceVersion: "736385"
      uid: 16c58521-b6b0-4e94-be7f-dfb8ac118f77
    spec:
      cronSpec: "* * * * */5"
      image: my-awesome-cron-image
kind: List
metadata:
  resourceVersion: ""
  selfLink: ""
```

## Controller

自定义的资源创建完成了，但是也只是单纯的把资源清单数据存入到了 etcd 中而已，并没有什么其他用处，因为没有定义一个对应的 Controller 来处理它。

官方提供了一个自定义 Controller 的示例：https://github.com/kubernetes/sample-controller，实现了：

- 如何注册资源 Foo
- 如何创建、删除和查询 Foo 对象
- 如何监听 Foo 资源对象的变化情况

要想了解 Controller 的实现原理和方式，就需要了解下 [client-go](https://github.com/kubernetes/client-go/) 这个库的实现，Kubernetes 部分代码也是基于这个库实现的，也包含了开发自定义控制器时可以使用的各种机制，这些机制在 client-go 源码的 [tools/cache](https://github.com/kubernetes/client-go/tree/master/tools/cache) 目录下面有定义。

下图显示了 client-go 中的各个组件是如何工作的以及要编写自定义控制器代码的交互入口：

![client-go controller interaction](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/client-go-controller-interaction.jpeg)

### **client-go 组件**：

- Reflector：通过 Kubernetes API 监控 Kubernetes 的资源类型 采用 List/Watch 机制, 可以 Watch 任何资源包括 CRD 添加 object 对象到 FIFO 队列，然后 Informer 会从队列里面取数据
- Informer：controller 机制的基础，循环处理 object 对象 从 Reflector 取出数据，然后将数据给到 Indexer 去缓存，提供对象事件的 handler 接口，只要给 Informer 添加 `ResourceEventHandler` 实例的回调函数，去实现 `OnAdd(obj interface{})`、 `OnUpdate(oldObj, newObj interface{})` 和 `OnDelete(obj interface{})` 这三个方法，就可以处理好资源的创建、更新和删除操作了。
- Indexer：提供 object 对象的索引，是线程安全的，缓存对象信息

### **controller 组件**：

- Informer reference: controller 需要创建合适的 Informer 才能通过 Informer reference 操作资源对象
- Indexer reference: controller 创建 Indexer reference 然后去利用索引做相关处理
- Resource Event Handlers：Informer 会回调这些 handlers
- Work queue: Resource Event Handlers 被回调后将 key 写到工作队列，这里的 key 相当于事件通知，后面根据取出事件后，做后续的处理
- Process Item：从工作队列中取出 key 后进行后续处理，具体处理可以通过 Indexer reference controller 可以直接创建上述两个引用对象去处理，也可以采用工厂模式，官方都有相关示例

`client-go/tool/cache/` 和自定义 Controller 的控制流([图片来源](https://itnext.io/how-to-create-a-kubernetes-custom-controller-using-client-go-f36a7a7536cc))：

![client-go controller workflow](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/client-go-controller-workflow.png)

如上图所示主要有两个部分，一个是发生在 `SharedIndexInformer` 中，另外一个是在自定义控制器中。

1. `Reflector` 通过 Kubernetes APIServer 执行对象（比如 Pod）的 `ListAndWatch` 查询，记录和对象相关的三种事件类型`Added`、`Updated`、`Deleted`，然后将它们传递到 `DeltaFIFO` 中去。
2. `DeltaFIFO` 接收到事件和 watch 事件对应的对象，然后将它们转换为 `Delta` 对象，这些 `Delta` 对象被附加到队列中去等待处理，对于已经删除的，会检查线程安全的 store 中是否已经存在该文件，从而可以避免在不存在某些内容时排队执行删除操作。
3. Cache 控制器（不要和自定义控制器混淆）调用 `Pop()` 方法从 `DeltaFIFO` 队列中出队列，`Delta` 对象将传递到 `SharedIndexInformer` 的 `HandleDelta()` 方法中以进行进一步处理。
4. 根据 `Delta` 对象的操作（事件）类型，首先在 `HandleDeltas` 方法中通过 `indexer` 的方法将对对象保存到线程安全的 Store 中，然后，通过 `SharedIndexInformer` 中的 `sharedProcessor` 的 `distribution()` 方法将这些对象发送到事件 handlers，这些事件处理器由自定义控制器通过 `SharedInformer` 的方法比如 `AddEventHandlerWithResyncPeriod()` 进行注册。
5. 已注册的事件处理器通过添加或更新时间的 `MetaNamespaceKeyFunc()` 或删除事件的 `DeletionHandingMetaNamespaceKeyFunc()` 将对象转换为格式为 `namespace/name` 或只是 `name` 的 key，然后将这个 key 添加到自定义控制器的 `workqueue` 中，`workqueues` 的实现可以在 `util/workqueue` 中找到。
6. 自定义的控制器通过调用定义的 handlers 处理器从 workqueue 中 pop 一个 key 出来进行处理，handlers 将调用 indexer 的 `GetByKey()` 从线程安全的 store 中获取对象，业务逻辑就是在这个 handlers 里面实现。

`client-go` 中也有自定义 Controller 的样例代码，位于：`k8s.io/client-go/examples/workqueue/main.go`。

## Operator

`Operator` 就可以看成是 CRD 和 Controller 的一种组合特例，Operator 是一种思想，它结合了特定领域知识并通过 CRD 机制扩展了 Kubernetes API 资源，使用户管理 Kubernetes 的内置资源（Pod、Deployment 等）一样创建、配置和管理应用程序，Operator 是一个特定的应用程序的控制器，通过扩展 Kubernetes API 资源以代表 Kubernetes 用户创建、配置和管理复杂应用程序的实例，通常包含资源模型定义和控制器，通过 `Operator` 通常是为了实现某种特定软件（通常是有状态服务）的自动化运维。

完全可以通过上面的方式编写一个 CRD 对象，然后去手动实现一个对应的 Controller 就可以实现一个 Operator，但是从头开始去构建一个 CRD 控制器并不容易，需要对 Kubernetes 的 API 有深入了解，并且 RBAC 集成、镜像构建、持续集成和部署等都需要很大工作量。为了解决这个问题，社区就推出了对应的简单易用的 Operator 框架，比较主流的是 [kubebuilder](https://github.com/kubernetes-sigs/kubebuilder) 和 [Operator Framework](https://coreos.com/operators)，这两个框架的使用基本上差别不大，可以根据自己习惯选择一个即可。

