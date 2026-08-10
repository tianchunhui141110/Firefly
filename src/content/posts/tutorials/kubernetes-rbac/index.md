---
title: "Kubernetes-RBAC"
published: 2023-11-07
description: "对于资源对象的操作都是通过 APIServer 进行的，那么集群是怎样知道请求就是合法的请求呢？这个就需要了解 Kubernetes 中另外一个非常重要的知识点了：RBAC（基于角色的权限控制）。"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

对于资源对象的操作都是通过 APIServer 进行的，那么集群是怎样知道请求就是合法的请求呢？这个就需要了解 Kubernetes 中另外一个非常重要的知识点了：`RBAC`（基于角色的权限控制）。

管理员可以通过 Kubernetes API 动态配置策略来启用`RBAC`，需要在 kube-apiserver 中添加参数`--authorization-mode=RBAC`，如果使用的 kubeadm 安装的集群那么是默认开启了 `RBAC` 的，可以通过查看 Master 节点上 apiserver 的静态 Pod 定义文件：

```shell
cat /etc/kubernetes/manifests/kube-apiserver.yaml|grep authorization-mode
```

![image-20231106172346729](https://blog.tianch.com.cn/img/image-20231106172346729.png)

如果是二进制的方式搭建的集群，添加这个参数过后，记得要重启 kube-apiserver 服务。

## API对象

在学习 `RBAC` 之前，还需要再去理解下 Kubernetes 集群中的对象，在 Kubernetes 集群中，Kubernetes 对象是持久化的实体，就是最终存入 etcd 中的数据，集群中通过这些实体来表示整个集群的状态。前面都直接编写的 YAML 文件，通过 kubectl 来提交的资源清单文件，然后创建的对应的资源对象，那么它究竟是如何将 YAML 文件转换成集群中的一个 API 对象的呢？

这个就需要去了解下**声明式 API**的设计，Kubernetes API 是一个以 JSON 为主要序列化方式的 HTTP 服务，除此之外也支持 Protocol Buffers 序列化方式，主要用于集群内部组件间的通信。为了可扩展性，Kubernetes 在不同的 API 路径（比如`/api/v1` 或者 `/apis/batch`）下面支持了多个 API 版本，不同的 API 版本意味着不同级别的稳定性和支持：

- Alpha 级别，例如 `v1alpha1` 默认情况下是被禁用的，可以随时删除对功能的支持，所以要慎用
- Beta 级别，例如 `v2beta1` 默认情况下是启用的，表示代码已经经过了很好的测试，但是对象的语义可能会在随后的版本中以不兼容的方式更改
- 稳定级别，比如 `v1` 表示已经是稳定版本了，也会出现在后续的很多版本中。

在 Kubernetes 集群中，一个 API 对象在 Etcd 里的完整资源路径，是由：`Group（API 组）`、`Version（API 版本）`和 `Resource（API 资源类型）`三个部分组成的。通过这样的结构，整个 Kubernetes 里的所有 API 对象，实际上就可以用如下的树形结构表示出来：

![apiserver tree](https://blog.tianch.com.cn/img/20231106172513.jpeg)

从上图中也可以看出 Kubernetes 的 API 对象的组织方式，在顶层，可以看到有一个核心组（由于历史原因，是 `/api/v1` 下的所有内容而不是在 `/apis/core/v1` 下面）和命名组（路径 `/apis/$NAME/$VERSION`）和系统范围内的实体，比如 `/metrics`。也可以用下面的命令来查看集群中的 API 组织形式：

```sh
kubectl get --raw /
```

```json
{
  "paths": [
    "/.well-known/openid-configuration",
    "/api",
    "/api/v1",
    "/apis",
    ......
    "/version"
  ]
}
```

比如查看批处理这个操作，在当前这个版本中存在 1 个版本的操作：`/apis/batch/v1`，暴露了可以查询和操作的不同实体集合，同样还是可以通过 kubectl 来查询对应对象下面的数据：

```shell
kubectl get --raw /apis/batch/v1 | python -m json.tool
```

```json
{
  "apiVersion": "v1",
  "groupVersion": "batch/v1",
  "kind": "APIResourceList",
  "resources": [
    {
      "categories": ["all"],
      "kind": "CronJob",
      "name": "cronjobs",
      "namespaced": true,
      "shortNames": ["cj"],
      "singularName": "",
      "storageVersionHash": "sd5LIXh4Fjs=",
      "verbs": [
        "create",
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "update",
        "watch"
      ]
    },
    {
      "kind": "CronJob",
      "name": "cronjobs/status",
      "namespaced": true,
      "singularName": "",
      "verbs": ["get", "patch", "update"]
    },
    {
      "categories": ["all"],
      "kind": "Job",
      "name": "jobs",
      "namespaced": true,
      "singularName": "",
      "storageVersionHash": "mudhfqk/qZY=",
      "verbs": [
        "create",
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "update",
        "watch"
      ]
    },
    {
      "kind": "Job",
      "name": "jobs/status",
      "namespaced": true,
      "singularName": "",
      "verbs": ["get", "patch", "update"]
    }
  ]
}
```

但是这个操作和平时操作 HTTP 服务的方式不太一样，这里可以通过 `kubectl proxy` 命令来开启对 apiserver 的访问：

```sh
kubectl proxy
```

![image-20231106174039875](https://blog.tianch.com.cn/img/20231106174041.png)

然后重新开启一个新的终端，可以通过如下方式来访问批处理的 API 服务：

```shell
curl http://127.0.0.1:8001/apis/batch/v1
```

```json
{
  "apiVersion": "v1",
  "groupVersion": "batch/v1",
  "kind": "APIResourceList",
  "resources": [
    {
      "categories": ["all"],
      "kind": "CronJob",
      "name": "cronjobs",
      "namespaced": true,
      "shortNames": ["cj"],
      "singularName": "",
      "storageVersionHash": "sd5LIXh4Fjs=",
      "verbs": [
        "create",
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "update",
        "watch"
      ]
    },
    {
      "kind": "CronJob",
      "name": "cronjobs/status",
      "namespaced": true,
      "singularName": "",
      "verbs": ["get", "patch", "update"]
    },
    {
      "categories": ["all"],
      "kind": "Job",
      "name": "jobs",
      "namespaced": true,
      "singularName": "",
      "storageVersionHash": "mudhfqk/qZY=",
      "verbs": [
        "create",
        "delete",
        "deletecollection",
        "get",
        "list",
        "patch",
        "update",
        "watch"
      ]
    },
    {
      "kind": "Job",
      "name": "jobs/status",
      "namespaced": true,
      "singularName": "",
      "verbs": ["get", "patch", "update"]
    }
  ]
}
```

通常，Kubernetes API 支持通过标准 HTTP `POST`、`PUT`、`DELETE` 和 `GET` 在指定 PATH 路径上创建、更新、删除和检索操作，并使用 JSON 作为默认的数据交互格式。

比如现在要创建一个 Deployment 对象，那么 YAML 文件的声明就需要怎么写：

```yaml
apiVersion: apps/v1
kind: Deployment
```

其中 `Deployment` 就是这个 API 对象的资源类型（Resource），`apps` 就是它的组（Group），`v1` 就是它的版本（Version）。API Group、Version 和 资源就唯一定义了一个 HTTP 路径，然后在 kube-apiserver 端对这个 url 进行了监听，然后把对应的请求传递给了对应的控制器进行处理而已，当然在 Kuberentes 中的实现过程是非常复杂的。

## RBAC

上面介绍了 Kubernetes 所有资源对象都是模型化的 API 对象，允许执行 `CRUD(Create、Read、Update、Delete)` 操作(也就是常说的增、删、改、查操作)，比如下面的这些资源：

- Pods
- ConfigMaps
- Deployments
- Nodes
- Secrets
- Namespaces
- ......

对于上面这些资源对象的**可能**存在的操作有：

- create
- get
- delete
- list
- update
- edit
- watch
- exec
- patch

在更上层，这些资源和 API Group 进行关联，比如 Pods 属于 Core API Group，而 Deployements 属于 apps API Group，现在我们要在 Kubernetes 中通过 RBAC 来对资源进行权限管理，除了上面的这些资源和操作以外，还需要了解另外几个概念：

- `Rule`：规则，规则是一组属于不同 API Group 资源上的一组操作的集合
- `Role` 和 `ClusterRole`：角色和集群角色，这两个对象都包含上面的 Rules 元素，二者的区别在于，在 Role 中，定义的规则只适用于单个命名空间，也就是和 namespace 关联的，而 ClusterRole 是集群范围内的，因此定义的规则不受命名空间的约束。另外 Role 和 ClusterRole 在 Kubernetes 中都被定义为集群内部的 API 资源，和前面的 Pod、Deployment 这些对象类似，都是集群的资源对象，所以同样的可以使用 YAML 文件来描述，用 kubectl 工具来管理
- `Subject`：主题，对应集群中尝试操作的对象，集群中定义了 3 种类型的主题资源：
  - `User Account`：用户，这是有外部独立服务进行管理的，管理员进行私钥的分配，用户可以使用 KeyStone 或者 Goolge 帐号，甚至一个用户名和密码的文件列表也可以。对于用户的管理集群内部没有一个关联的资源对象，所以用户不能通过集群内部的 API 来进行管理
  - `Group`：组，这是用来关联多个账户的，集群中有一些默认创建的组，比如 cluster-admin
  - `Service Account`：服务帐号，通过 Kubernetes API 来管理的一些用户帐号，和 namespace 进行关联的，适用于集群内部运行的应用程序，需要通过 API 来完成权限认证，所以在集群内部进行权限操作，都需要使用到 ServiceAccount
- `RoleBinding` 和 `ClusterRoleBinding`：角色绑定和集群角色绑定，简单来说就是把声明的 Subject 和 Role 进行绑定的过程（给某个用户绑定上操作的权限），二者的区别也是作用范围的区别：RoleBinding 只会影响到当前 namespace 下面的资源操作权限，而 ClusterRoleBinding 会影响到所有的 namespace。

### 只能访问某个 namespace 的普通用户

创建一个 User Account，只能访问 kube-system 这个命名空间，对应的用户信息如下所示：

```yaml
username: tianch
group: tch
```

#### 创建用户凭证

Kubernetes 没有 User Account 的 API 对象，不过要创建一个用户帐号的话也是挺简单的，利用管理员分配给你的一个私钥就可以创建了，这个可以参考官方文档中的方法，这里来使用 `OpenSSL` 证书来创建一个 User，当然也可以使用更简单的 `cfssl`工具来创建：

给用户 tianch 创建一个私钥，命名成 `tianch.key`：

```sh
openssl genrsa -out tianch.key 2048
```

![image-20231106180944671](https://blog.tianch.com.cn/img/20231106180946.png)

使用刚刚创建的私钥创建一个证书签名请求文件：`tianch.csr`，要注意需要确保在 `-subj` 参数中指定用户名和组(`CN`表示用户名，`O`表示组)：

```sh
openssl req -new -key tianch.key -out tianch.csr -subj "/CN=tianch/O=tch"
```

然后找到 Kubernetes 集群的 `CA` 证书，CA 相关证书位于 `/etc/kubernetes/pki/` 目录下面，利用该目录下面的 `ca.crt` 和 `ca.key`两个文件来批准上面的证书请求。生成最终的证书文件，这里设置证书的有效期为 500 天：

```shell
openssl x509 -req -in tianch.csr -CA /etc/kubernetes/pki/ca.crt -CAkey /etc/kubernetes/pki/ca.key -CAcreateserial -out tianch.crt -days 500
```

![image-20231106180958587](https://blog.tianch.com.cn/img/20231106181000.png)

![image-20231106181054755](https://blog.tianch.com.cn/img/20231106181057.png)

使用刚刚创建的证书文件和私钥文件在集群中创建新的凭证和上下文(Context):

```sh
kubectl config set-credentials tianch --client-certificate=tianch.crt --client-key=tianch.key
```

用户 `tianch` 创建了，然后为这个用户设置新的 Context，这里指定特定的一个 namespace：

`--cluster`需要获取自己的集群名称:

```sh
kubectl config get-clusters
```

![image-20231107102254048](https://blog.tianch.com.cn/img/20231107180324.png)

```sh
kubectl config set-context tianch-context --cluster=cluster.local --namespace=kube-system --user=tianch
```

到这里用户 `tianch` 就已经创建成功了，现在使用当前的这个配置文件来操作 kubectl 命令的时候，应该会出现错误，因为还没有为该用户定义任何操作的权限呢：

```shell
kubectl get pods --context=tianch-context
```

![image-20231106181301623](https://blog.tianch.com.cn/img/20231106181303.png)

#### 创建角色

用户创建完成后，接下来就需要给该用户添加操作权限，定义一个 YAML 文件，创建一个允许用户操作 Deployment、Pod、ReplicaSets 的角色，如下定义：_tianch-role.yaml_

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: tianch-role
  namespace: kube-system
rules:
  - apiGroups: ["", "apps"]
    resources: ["deployments", "replicasets", "pods"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"] # 也可以使用['*']
```

其中 Pod 属于 `core` 这个 API Group，在 YAML 中用空字符就可以，而 Deployment 和 ReplicaSet 现在都属于 `apps` 这个 API Group（如果不知道则可以用 `kubectl explain` 命令查看），所以 `rules` 下面的 `apiGroups` 就综合了这几个资源的 API Group：["", "apps"]，其中 `verbs` 就是上面提到的可以对这些资源对象执行的操作，这里需要所有的操作方法，所以也可以使用`['*']`来代替，然后直接创建这个 Role：

```sh
kubectl create -f tianch-role.yaml
```

注意这里没有使用上面的 `tianch-context` 这个上下文，因为暂时还没有权限。

#### 创建`角色和权限绑定`

Role 创建完成了，但是这个 `Role` 和用户 `tianch` 还没有任何关系，这里就需要创建一个 `RoleBinding` 对象，在 kube-system 这个命名空间下面将上面的 `tianch-role` 角色和用户 `tianch` 进行绑定：

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: tianch-rolebinding
  namespace: kube-system
subjects:
  - kind: User
    name: tianch
    apiGroup: ""
roleRef:
  kind: Role
  name: tianch-role
  apiGroup: rbac.authorization.k8s.io # 留空字符串也可以，则使用当前的apiGroup
```

上面的 YAML 文件中看到了 `subjects` 字段，这里就是上面提到的用来尝试操作集群的对象，这里对应上面的 `User` 帐号 `tianch`，使用 kubectl 创建上面的资源对象：

```sh
kubectl create -f tianch-rolebinding.yaml
```

#### 测试

现在应该可以用上面的 `tianch-context` 上下文来操作集群了：

```sh
kubectl get pods --context=tianch-context
```

![image-20231107102711882](https://blog.tianch.com.cn/img/20231107102713.png)

可以看到使用 kubectl 的使用并没有指定 namespace，这是因为上面创建这个 Context 的时候就绑定在了 kube-system 这个命名空间下面，如果在后面加上一个`-n default`

```shell
kubectl --context=tianch.context get pods --namespace=default
```

![image-20231107102931165](https://blog.tianch.com.cn/img/image-20231107102931165.png)

获取其他的资源对象:

```sh
kubectl --context=tianch-context get svc
```

![image-20231107103126664](https://blog.tianch.com.cn/img/20231107103128.png)

可以看到没有权限获取，因为并没有为当前操作用户指定其它对象资源的访问权限，是符合预期的。这样就创建了一个只有单个命名空间访问权限的普通 User。

### 只能访问某个 namespace 的 ServiceAccount

上面创建了一个只能访问某个命名空间下面的**普通用户**，前面也提到过 `subjects` 下面还有一种类型的主题资源：`ServiceAccount`，现在来创建一个集群内部的用户只能操作 kube-system 这个命名空间下面的 pods 和 deployments，首先来创建一个 `ServiceAccount` 对象：

```sh
kubectl create sa tianch-sa -n kube-system
```

也可以定义成 YAML 文件的形式来创建：

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: tianch-sa
  namespace: kube-system
```

然后新建一个 Role 对象和对象绑定：_tianch-sa.yaml_

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: tianch-sa-role
  namespace: kube-system
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "watch", "list"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

---
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: tianch-sa-rolebinding
  namespace: kube-system
subjects:
  - kind: ServiceAccount
    name: tianch-sa
    namespace: kube-system
roleRef:
  kind: Role
  name: tianch-sa-role
  apiGroup: rbac.authorization.k8s.io
```

可以看到这里定义的角色没有`创建、删除、更新` Pod 的权限，创建该 Role 对象和RoleBinding对象：

```shell
kubectl apply -f tianch-sa.yaml
```

![image-20231107110333855](https://blog.tianch.com.cn/img/20231107110336.png)

```sh
kubectl get secret tianch-sa-token-qm9wg -o jsonpath={.data.token} -n kube-system |base64 -d
```

ServiceAccount 会生成一个 Secret 对象和它进行映射，这个 Secret 里面包含一个 token，我们可以利用这个 token 去登录 Dashboard，然后我们就可以在 Dashboard 中来验证我们的功能是否符合预期。

##### 安装Dashboard

```sh
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml
```

##### 设置Service外网访问

```sh
kubectl edit service kubernetes-dashboard -n kubernetes-dashboard
```

把`spec.type`改为`NodePort` `esc+wq`退出

```yaml
apiVersion: v1
kind: Service
metadata:
  annotations:
    kubectl.kubernetes.io/last-applied-configuration: |
      {"apiVersion":"v1","kind":"Service","metadata":{"annotations":{},"labels":{"k8s-app":"kubernetes-dashboard"},"name":"kubernetes-dashboard","namespace":"kubernetes-dashboard"},"spec":{"ports":[{"port":443,"targetPort":8443}],"selector":{"k8s-app":"kubernetes-dashboard"}}}
  creationTimestamp: "2023-11-07T03:08:57Z"
  labels:
    k8s-app: kubernetes-dashboard
  name: kubernetes-dashboard
  namespace: kubernetes-dashboard
  resourceVersion: "345760"
  uid: 760038b9-2d32-4897-8f41-2fb5188dd52f
spec:
  clusterIP: 10.233.61.54
  clusterIPs:
    - 10.233.61.54
  externalTrafficPolicy: Cluster
  internalTrafficPolicy: Cluster
  ipFamilies:
    - IPv4
  ipFamilyPolicy: SingleStack
  ports:
    - nodePort: 31186
      port: 443
      protocol: TCP
      targetPort: 8443
  selector:
    k8s-app: kubernetes-dashboard
  sessionAffinity: None
  type: NodePort
status:
  loadBalancer: {}
```

![image-20231107111614495](https://blog.tianch.com.cn/img/20231107111616.png)

在default命名空间下提示没有权限,切换到kube-system命名空间后就可以了

![image-20231107111851720](https://blog.tianch.com.cn/img/20231107111854.png)

可以看到可以访问 pod 列表了，但是也会有一些其他额外的提示：`events is forbidden: User “system:serviceaccount:kube-system:tianch-sa” cannot list events in the namespace “kube-system”`，这是因为当前登录用只被授权了访问 pod 和 deployment 的权限。

可以根据自己的需求来对访问用户的权限进行限制，可以通过 Role 定义更加细粒度的权限，也可以使用系统内置的一些权限。

### 可以全局访问的 ServiceAccount

上面创建的 tianch-sa 这个 `ServiceAccount` 和一个 `Role` 角色进行绑定的，如果创建一个新的 ServiceAccount，需要它操作的权限作用于所有的 namespace，这个时候就需要使用到 `ClusterRole` 和 `ClusterRoleBinding` 这两种资源对象了。首先新建一个 ServiceAcount 对象：(tianch-sa2.yaml)

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: tianch-sa2
  namespace: kube-system
```

后创建一个 ClusterRoleBinding 对象*tianch-clusterolebinding.yaml*

```yaml
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: tianch-sa2-clusterrolebinding
subjects:
  - kind: ServiceAccount
    name: tianch-sa2
    namespace: kube-system
roleRef:
  kind: ClusterRole
  name: cluster-admin
  apiGroup: rbac.authorization.k8s.io
```

上面没有为这个资源对象声明 namespace，因为这是一个 ClusterRoleBinding 资源对象，是作用于整个集群的，也没有单独新建一个 ClusterRole 对象，而是使用的 `cluster-admin` 这个对象，这是 Kubernetes 集群内置的 ClusterRole 对象，可以使用 `kubectl get clusterrole` 和 `kubectl get clusterrolebinding` 查看系统内置的一些集群角色和集群角色绑定，这里使用的 `cluster-admin` 这个集群角色是拥有最高权限的集群角色，所以一般需要谨慎使用该集群角色。

创建上面集群角色绑定资源对象，创建完成后同样使用 ServiceAccount 对应的 token 去登录 Dashboard 验证下：

```sh
kubectl apply -f tianch-clusterolebinding.yaml
```

![image-20231107141012264](https://blog.tianch.com.cn/img/20231107141014.png)

获取登录token

```sh
kubectl get secret tianch-sa2-token-xr4ht -o jsonpath={.data.token} -n kube-system |base64 -d
```

![image-20231107141201837](https://blog.tianch.com.cn/img/20231107141204.png)

一开始没有权限的default命名空间也可以访问了。

