---
title: "Kubernetes-Secret"
published: 2026-01-05
description: "一般情况下 ConfigMap 是用来存储一些非安全的配置信息，如果涉及到一些安全相关的数据的话用 ConfigMap 就非常不妥了，因为 ConfigMap 是明文存储的，这个时候我们就需要用到另外一个资源对象了：Secret，Secre"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

一般情况下 ConfigMap 是用来存储一些非安全的配置信息，如果涉及到一些安全相关的数据的话用 ConfigMap 就非常不妥了，因为 ConfigMap 是明文存储的，这个时候我们就需要用到另外一个资源对象了：`Secret`，`Secret`用来保存敏感信息，例如密码、OAuth 令牌和 ssh key 等等，将这些信息放在 `Secret` 中比放在 Pod 的定义中或者 Docker 镜像中要更加安全和灵活。

`Secret` 主要使用的有以下三种类型：

- `Opaque`：base64 编码格式的 Secret，用来存储密码、密钥等；但数据也可以通过 `base64 –decode` 解码得到原始数据，所有加密性很弱。
- `kubernetes.io/dockercfg`: `~/.dockercfg` 文件的序列化形式
- `kubernetes.io/dockerconfigjson`：用来存储私有`docker registry`的认证信息，`~/.docker/config.json` 文件的序列化形式
- `kubernetes.io/service-account-token`：用于 `ServiceAccount`, ServiceAccount 创建时 Kubernetes 会默认创建一个对应的 Secret 对象，Pod 如果使用了 ServiceAccount，对应的 Secret 会自动挂载到 Pod 目录 `/run/secrets/kubernetes.io/serviceaccount` 中
- `kubernetes.io/ssh-auth`：用于 SSH 身份认证的凭据
- `kubernetes.io/basic-auth`：用于基本身份认证的凭据
- `bootstrap.kubernetes.io/token`：用于节点接入集群的校验的 Secret

> 上面是 Secret 对象内置支持的几种类型，通过为 Secret 对象的 type 字段设置一个非空的字符串值，也可以定义并使用自己 Secret 类型。如果 type 值为空字符串，则被视为 Opaque 类型。Kubernetes 并不对类型的名称作任何限制，不过，如果要使用内置类型之一， 则你必须满足为该类型所定义的所有要求。

## Opaque

`Secret` 资源包含2个键值对： `data` 和 `stringData`，`data` 字段用来存储 base64 编码的任意数据，提供 `stringData` 字段是为了方便，它允许 Secret 使用未编码的字符串。 `data` 和 `stringData` 的键必须由字母、数字、`-`，`_` 或 `.` 组成。

比如创建一个用户名为 admin，密码为 admin321 的 `Secret` 对象，首先需要先把用户名和密码做 `base64` 编码：

```sh
echo -n "admin" | base64
```

```sh
echo -n "admin321" | base64
```

然后我们就可以利用上面编码过后的数据来编写一个 YAML 文件：_secret-demo.yaml_

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mysecret
type: Opaque
data:
  username: YWRtaW4=
  password: YWRtaW4zMjE=
```

```sh
kubectl apply -f 6.secret-demo.yaml
```

```sh
kubectl describe secret mysecret -n default
```

```sh
kubectl get secret mysecret -n default
```

![image-20231106153029910](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231106153035.png)

对于某些场景，可能希望使用 `stringData` 字段，这字段可以将一个非 base64 编码的字符串直接放入 Secret 中， 当创建或更新该 Secret 时，此字段将被编码。

比如当我们部署应用时，使用 Secret 存储配置文件， 希望在部署过程中，填入部分内容到该配置文件。例如，如果应用程序使用以下配置文件:

```yaml
apiUrl: "https://my.api.com/api/v1"
username: "<user>"
password: "<password>"
```

那么就可以使用以下定义将其存储在 Secret 中:_secret-demo2.yaml_

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mysecret2
type: Opaque
stringData:
  config.yaml: |
    apiUrl: "https://my.api.com/api/v1"
    username: <user>
    password: <Password>
```

![image-20231106153726907](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231106153728.png)

创建好 `Secret`对象后，有两种方式来使用它：

- 以环境变量的形式
- 以Volume的形式挂载

### 环境变量

首先来测试下环境变量的方式，使用一个简单的 busybox 镜像来测试下:_secret1-pod.yaml_

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret1-pod
spec:
  containers:
    - name: secret1
      image: busybox
      command:
        - "/bin/sh"
        - "-c"
        - "env"
      env:
        - name: USERNAME
          valueFrom:
            secretKeyRef:
              name: mysecret
              key: username
        - name: PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysecret
              key: password
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

![image-20231106161019493](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231106161021.png)

### Volume挂载

用一个 Pod 来验证下 `Volume` 挂载，创建一个 Pod 文件：_secret2-pod.yaml_

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret2-pod
spec:
  volumes:
    - name: secrets
      secret:
        secretName: mysecret
  containers:
    - name: secret2
      image: busybox
      command:
        - "/bin/sh"
        - "-c"
        - "ls /etc/secrets"
      volumeMounts:
        - name: secrets
          mountPath: /etc/secrets
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

![image-20231106161817360](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231106161819.png)

可以看到 Secret 把两个 key 挂载成了两个对应的文件。当然如果想要挂载到指定的文件上面，可以在 `secretName` 下面添加 `items` 指定 `key` 和 `path`。

## kubernetes.io/dockerconfigjson

除了上面的 `Opaque` 这种类型外，我们还可以来创建用户 `docker registry` 认证的 `Secret`，直接使用``kubectl create` 命令创建即可，如下：

```shell
kubectl create secret docker-registry myregistry --docker-server=DOCKER_SERVER --docker-username=DOCKER_USER --docker-password=DOCKER_PASSWORD --docker-email=DOCKER_EMAIL
```

除了上面这种方法之外，也可以通过指定文件的方式来创建镜像仓库认证信息，需要注意对应的 `KEY` 和 `TYPE`：

```yaml
kubectl create secret generic myregistry --from-file=.dockerconfigjson=/root/.docker/config.json --type=kubernetes.io/dockerconfigjson
```

![image-20231106163012987](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231106163015.png)

注意看上面的 TYPE 类型，myregistry 对应的是 `kubernetes.io/dockerconfigjson`，同样的可以使用 describe 命令来查看详细信息：

```sh
kubectl describe secret myregistry -n default
```

![image-20231106163540411](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231106163542.png)

`data.dockerconfigjson` 下面的数据是 `base64` 编码后的结果。

如果需要拉取私有仓库中的 Docker 镜像的话就需要使用到上面的 myregistry 这个 `Secret`：

```shell
apiVersion: v1
kind: Pod
metadata:
  name: foo
spec:
  containers:
  - name: foo
    image: 192.168.1.100:5000/test:v1
  imagePullSecrets:
  - name: myregistry
```

**IMAGEPULLSECRETS:**`ImagePullSecrets` 与 `Secrets` 不同，因为 `Secrets` 可以挂载到 Pod 中，但是 `ImagePullSecrets` 只能由 Kubelet 访问。

拉取私有仓库镜像 `192.168.1.100:5000/test:v1`，就需要针对该私有仓库来创建一个如上的 `Secret`，然后在 Pod 中指定 `imagePullSecrets`。

除了设置 `Pod.spec.imagePullSecrets` 这种方式来获取私有镜像之外，还可以通过在 `ServiceAccount` 中设置 `imagePullSecrets`，然后就会自动为使用该 SA 的 Pod 注入 `imagePullSecrets` 信息：

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: default
  namespace: default
  resourceVersion: "332"
  selfLink: /api/v1/namespaces/default/serviceaccounts/default
  uid: cc37a719-c4fe-4ebf-92da-u92c3e24d5d4
secrets:
  - name: default-token-5ttg7
imagePullSecrets:
  - name: myregistry
```

## kubernetes.io/basic-auth

该类型用来存放用于基本身份认证所需的凭据信息，使用这种 Secret 类型时，Secret 的 data 字段（不一定）必须包含以下两个键（相当于是约定俗成的一个规定）：

- `username`: 用于身份认证的用户名
- `password`: 用于身份认证的密码或令牌

以上两个键的键值都是 `base64` 编码的字符串。 也可以在创建 Secret 时使用 `stringData` 字段来提供明文形式的内容。下面的 YAML 是基本身份认证 Secret 的一个示例清单：_secret-basic-auth.yaml_

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: secret-basic-auth
type: kubernetes.io/basic-auth
stringData:
  username: admin
  password: adminbasicauth
```

提供基本身份认证类型的 Secret 仅仅是出于用户方便性考虑，也可以使用 Opaque 类型来保存用于基本身份认证的凭据，不过使用内置的 Secret 类型的有助于对凭据格式进行统一处理。

## kubernetes.io/ssh-auth

该类型用来存放 SSH 身份认证中所需要的凭据，使用这种 Secret 类型时，就必须在其 data（或 stringData）字段中提供一个 `ssh-privatekey` 键值对，作为要使用的 SSH 凭据。

如下所示是一个 SSH 身份认证 Secret 的配置示例：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: secret-ssh-auth
type: kubernetes.io/ssh-auth
data:
  ssh-privatekey: |
    MIIEpQIBAAKCAQEAulqb/Y ...
```

同样提供 SSH 身份认证类型的 Secret 也仅仅是出于用户方便性考虑，也可以使用 Opaque 类型来保存用于 SSH 身份认证的凭据，只是使用内置的 Secret 类型的有助于对凭据格式进行统一处理。

## kubernetes.io/tls

该类型用来存放证书及其相关密钥（通常用在 TLS 场合）。此类数据主要提供给 Ingress 资源，用以校验 TLS 链接，当使用此类型的 Secret 时，Secret 配置中的 data （或 stringData）字段必须包含 `tls.key` 和 `tls.crt`主键。下面的 YAML 包含一个 TLS Secret 的配置示例：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: secret-tls
type: kubernetes.io/tls
data:
  tls.crt: |
    MIIC2DCCAcCgAwIBAgIBATANBgkqh ...
  tls.key: |
    MIIEpgIBAAKCAQEA7yn3bRHQ5FHMQ ...
```

提供 TLS 类型的 Secret 仅仅是出于用户方便性考虑，也可以使用 Opaque 类型来保存用于 TLS 服务器与/或客户端的凭据。不过，使用内置的 Secret 类型的有助于对凭据格式进行统一化处理。当使用 kubectl 来创建 TLS Secret 时，可以像下面的例子一样使用 tls 子命令：

```sh
kubectl create secret tls my-tls-secret \
  --cert=path/to/cert/file \
  --key=path/to/key/file
```

需要注意的是用于 `--cert` 的公钥证书必须是 `.PEM` 编码的 （Base64 编码的 DER 格式），且与 `--key` 所给定的私钥匹配，私钥必须是通常所说的 PEM 私钥格式，且未加密。对这两个文件而言，PEM 格式数据的第一行和最后一行（例如，证书所对应的 `--------BEGIN CERTIFICATE-----` 和 `-------END CERTIFICATE----`）都不会包含在其中。

## kubernetes.io/service-account-token

另外一种 `Secret` 类型就是 `kubernetes.io/service-account-token`，用于被 `ServiceAccount` 引用。`ServiceAccout` 创建时 Kubernetes 会默认创建对应的 `Secret`，如下所示创建一个 Pod：

```sh
kubectl run secret-pod3 --image nginx -n default
```

```sh
kubectl get pods -n default
```

```sh
kubectl describe pod secret-pod3 -n default
```

![image-20231106165821857](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231106165823.png)

当创建 Pod 的时候，如果没有指定 ServiceAccount，Pod 则会使用命名空间中名为 default 的 ServiceAccount，上面我们可以看到 `spec.serviceAccountName` 字段已经被自动设置了。

可以看到这里通过一个 `projected` 类型的 Volume 挂载到了容器的 `/var/run/secrets/kubernetes.io/serviceaccount` 的目录中，`projected` 类型的 Volume 可以同时挂载多个来源的数据，这里挂载了一个 downwardAPI 来获取 namespace，通过 ConfigMap 来获取 `ca.crt` 证书，然后还有一个 `serviceAccountToken` 类型的数据源。

在之前的版本（v1.20）中，是直接将 `default`（自动创建的）的 `ServiceAccount` 对应的 Secret 对象通过 Volume 挂载到了容器的 `/var/run/secrets/kubernetes.io/serviceaccount` 的目录中的，现在的版本提供了更多的配置选项，比如上面配置了 `expirationSeconds` 和 `path` 两个属性。

前面也提到了默认情况下当前 namespace 下面的 Pod 会默认使用 `default` 这个 ServiceAccount，对应的 `Secret` 会自动挂载到 Pod 的 `/var/run/secrets/kubernetes.io/serviceaccount/` 目录中，这样就可以在 Pod 里面获取到用于身份认证的信息了。

可以使用自动挂载给 Pod 的 ServiceAccount 凭据访问 API，也可以通过在 ServiceAccount 上设置 `automountServiceAccountToken: false` 来实现不给 ServiceAccount 自动挂载 API 凭据：

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: build-robot
automountServiceAccountToken: false
...
```

此外也可以选择不给特定 Pod 自动挂载 API 凭据：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  serviceAccountName: build-robot
  automountServiceAccountToken: false
  ...
```

如果 Pod 和 ServiceAccount 都指定了 `automountServiceAccountToken` 值，则 Pod 的 spec 优先于 ServiceAccount。

### ServiceAccount Token 投影

`ServiceAccount` 是 Pod 和集群 apiserver 通讯的访问凭证，传统方式下，在 Pod 中使用 ServiceAccount 可能会遇到如下的安全挑战：

- `ServiceAccount` 中的 `JSON Web Token (JWT)` 没有绑定 audience 身份，因此所有 ServiceAccount 的使用者都可以彼此扮演，存在伪装攻击的可能
- 传统方式下每一个 ServiceAccount 都需要存储在一个对应的 Secret 中，并且会以文件形式存储在对应的应用节点上，而集群的系统组件在运行过程中也会使用到一些权限很高的 ServiceAccount，其增大了集群管控平面的攻击面，攻击者可以通过获取这些管控组件使用的 ServiceAccount 非法提权
- ServiceAccount 中的 JWT token 没有设置过期时间，当上述 ServiceAccount 泄露情况发生时，只能通过轮转 ServiceAccount 的签发私钥来进行防范
- 每一个 ServiceAccount 都需要创建一个与之对应的 Secret，在大规模的应用部署下存在弹性和容量风险

为解决这个问题 Kubernetes 提供了 ServiceAccount Token 投影特性用于增强 ServiceAccount 的安全性，ServiceAccount 令牌卷投影可使 Pod 支持以卷投影的形式将 ServiceAccount 挂载到容器中从而避免了对 Secret 的依赖。

通过 ServiceAccount 令牌卷投影可用于工作负载的 ServiceAccount 令牌是受时间限制，受 audience 约束的,并且不与 Secret 对象关联。如果删除了 Pod 或删除了 ServiceAccount，则这些令牌将无效，从而可以防止任何误用，Kubelet 还会在令牌即将到期时自动旋转令牌，另外，还可以配置希望此令牌可用的路径。

为了启用令牌请求投射（此功能在 Kubernetes 1.12 中引入，Kubernetes v1.20 已经稳定版本），你必须为 `kube-apiserver` 设置以下命令行参数，通过 kubeadm 安装的集群已经默认配置了：

```yaml
--service-account-issuer  # serviceaccount token 中的签发身份，即token payload中的iss字段。
--service-account-key-file # token 私钥文件路径
--service-account-signing-key-file  # token 签名私钥文件路径
--api-audiences (可选参数)  # 合法的请求token身份，用于apiserver服务端认证请求token是否合法。
```

配置完成后就可以指定令牌的所需属性，例如身份和有效时间，这些属性在默认 ServiceAccount 令牌上无法配置。当删除 Pod 或 ServiceAccount 时，ServiceAccount 令牌也将对 API 无效。

可以使用名为 `ServiceAccountToken` 的 `ProjectedVolume` 类型在 PodSpec 上配置此功能，比如要向 Pod 提供具有 "vault" 用户以及两个小时有效期的令牌，可以在 PodSpec 中配置以下内容：

例如当 Pod 中需要使用 audience 为 vault 并且有效期为2个小时的 ServiceAccount 时，我们可以使用以下模板配置 PodSpec 来使用 ServiceAccount 令牌卷投影。

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: build-robot

---
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
    - image: nginx
      name: nginx
      volumeMounts:
        - mountPath: /var/run/secrets/tokens
          name: vault-token
  serviceAccountName: build-robot
  volumes:
    - name: vault-token
      projected:
        sources:
          - serviceAccountToken:
              path: vault-token
              expirationSeconds: 7200
              audience: vault
```

kubelet 组件会替 Pod 请求令牌并将其保存起来，通过将令牌存储到一个可配置的路径使之在 Pod 内可用，并在令牌快要到期的时候刷新它。 kubelet 会在令牌存在期达到其 TTL 的 80% 的时候或者令牌生命期超过 24 小时的时候主动轮换它。应用程序负责在令牌被轮换时重新加载其内容。对于大多数使用场景而言，周期性地（例如，每隔 5 分钟）重新加载就足够了。

## 其他特性

如果某个容器已经在通过环境变量使用某 Secret，对该 Secret 的更新不会被容器马上看见，除非容器被重启，当然可以使用一些第三方的解决方案在 Secret 发生变化时触发容器重启。

在 Kubernetes v1.21 版本提供了不可变的 Secret 和 ConfigMap 的可选配置[stable]，可以设置 Secret 和 ConfigMap 为不可变的，对于大量使用 Secret 或者 ConfigMap 的集群（比如有成千上万各不相同的 Secret 供 Pod 挂载）时，禁止变更它们的数据有很多好处：

- 可以防止意外更新导致应用程序中断
- 通过将 Secret 标记为不可变来关闭 `kube-apiserver` 对其的 watch 操作，从而显著降低 `kube-apiserver` 的负载，提升集群性能

这个特性通过可以通过 `ImmutableEmphemeralVolumes` 特性门来进行开启，从 v1.19 开始默认启用，可以通过将 Secret 的 `immutable` 字段设置为 true 创建不可更改的 Secret。 例如：

```yaml
apiVersion: v1
kind: Secret
metadata: ...
data: ...
immutable: true # 标记为不可变
```

> 一旦一个 Secret 或 ConfigMap 被标记为不可更改，撤销此操作或者更改 data 字段的内容都是不允许的，只能删除并重新创建这个 Secret。现有的 Pod 将维持对已删除 Secret 的挂载点，所以建议重新创建这些 Pod。

## Secret vs ConfigMap

最后来对比下 `Secret` 和 `ConfigMap`这两种资源对象的异同点：

### 相同点

- key/value的形式
- 属于某个特定的命名空间
- 可以导出到环境变量
- 可以通过目录/文件形式挂载
- 通过 volume 挂载的配置信息均可热更新

### 不同点

- Secret 可以被 ServerAccount 关联
- Secret 可以存储 `docker register` 的鉴权信息，用在 `ImagePullSecret` 参数中，用于拉取私有仓库的镜像
- Secret 支持 `Base64` 加密
- Secret 分为 `kubernetes.io/service-account-token`、`kubernetes.io/dockerconfigjson`、`Opaque` 三种类型，而 `Configmap` 不区分类型

**使用注意:**同样 Secret 文件大小限制为 `1MB`（ETCD 的要求）；Secret 虽然采用 `Base64` 编码，但是还是可以很方便解码获取到原始信息，所以对于非常重要的数据还是需要慎重考虑，可以考虑使用 [Vault](https://www.vaultproject.io/) 来进行加密管理。

