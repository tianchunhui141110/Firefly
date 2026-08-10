---
title: "Kubernetes-Job与CronJob"
published: 2023-11-02
description: "Job 负责处理任务，即仅执行一次的任务，它保证批处理任务的一个或多个 Pod 成功结束。而CronJob 则就是在 Job 上加上了时间调度。"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

`Job` 负责处理任务，即仅执行一次的任务，它保证批处理任务的一个或多个 Pod 成功结束。而`CronJob` 则就是在 `Job` 上加上了时间调度。

## Job

用 `Job` 这个资源对象来创建一个任务:_job-demo.yaml_

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: job-demo
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: counter
          image: busybox
          command:
            - /bin/sh
            - -c
            - for i in 9 8 7 6 5 4 3 2 1; do echo $i; done
```

`Job` 中也是一个 Pod 模板，和之前的 Deployment、StatefulSet 之类的是一致的，只是 Pod 中的容器要求是一个任务，而不是一个常驻前台的进程了，因为需要退出，另外值得注意的是 `Job` 的 `RestartPolicy` 仅支持 `Never` 和 `OnFailure` 两种，不支持 `Always`，我们知道 `Job` 就相当于来执行一个批处理任务，执行完就结束了，如果支持 `Always` 的话就陷入死循环了

直接创建这个 Job 对象：

```sh
kubectl apply -f job-demo.yaml
```

```sh
kubectl get job -n default
```

```sh
kubectl get pod -n default
```

```sh
kubectl describe job job-demo -n default
```

![image-20231102111006796](https://blog.tianch.com.cn/img/image-20231102111006796.png)

![image-20231102111026826](https://blog.tianch.com.cn/img/image-20231102111026826.png)

Job 任务对应的 Pod 在运行结束后，会变成 `Completed` 状态，但是如果执行任务的 Pod 因为某种原因一直没有结束，可以在 Job 对象中通过设置字段 `spec.activeDeadlineSeconds` 来限制任务运行的最长时间，比如：

```yaml
spec:
  activeDeadlineSeconds: 100
```

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: job-demo
spec:
  template:
    spec:
      activeDeadlineSeconds: 100
      restartPolicy: Never
      containers:
        - name: counter
          image: busybox
          command:
            - /bin/sh
            - -c
            - sleep 600
```

那么当我们的任务 Pod 运行超过了 100s 后，这个 Job 的所有 Pod 都会被终止，并且， Pod 的终止原因会变成 `DeadlineExceeded`。

```text
Events:
  Type    Reason            Age                From               Message
  ----    ------            ----               ----               -------
  Normal  Scheduled         2m54s              default-scheduler  Successfully assigned default/job-demo1-wvdwr to node2
  Normal  Pulling           2m53s              kubelet            Pulling image "busybox"
  Normal  Pulled            2m51s              kubelet            Successfully pulled image "busybox" in 2.377149137s
  Normal  Created           2m51s              kubelet            Created container counter1
  Normal  Started           2m51s              kubelet            Started container counter1
  Normal  Killing           74s                kubelet            Stopping container counter1
  Normal  DeadlineExceeded  43s (x3 over 74s)  kubelet            Pod was active on the node longer than the specified deadline
```

如果的任务执行失败了，会怎么处理呢，这个和定义的 `restartPolicy` 有关系，比如定义如下所示的 Job 任务，定义 `restartPolicy: Never` 的重启策略：

![image-20231102112011909](https://blog.tianch.com.cn/img/image-20231102112011909.png)

设置成 `Never` 重启策略的时候，Job 任务执行失败后会不断创建新的 Pod，但是不会一直创建下去，会根据 `spec.backoffLimit` 参数进行限制，默认为6，通过该字段可以定义重建 Pod 的次数，另外需要注意的是 Job 控制器重新创建 Pod 的间隔是呈指数增加的，即下一次重新创建 Pod 的动作会分别发生在 10s、20s、40s… 后。

![image-20231102120729419](https://blog.tianch.com.cn/img/image-20231102120729419.png)

但是如果设置 `restartPolicy: OnFailure` 重启策略，则当 Job 任务执行失败后不会创建新的 Pod 出来，只会不断重启 Pod。

除此之外，还可以通过设置 `spec.parallelism` 参数来进行并行控制，该参数定义了一个 Job 在任意时间最多可以有多少个 Pod 同时运行。`spec.completions` 参数可以定义 Job 至少要完成的 Pod 数目。如下所示创建一个新的 Job 任务，设置允许并行数为2，至少要完成的 Pod 数为8：_job-para-demo.yaml_

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: job-para-test
spec:
  parallelism: 2
  completions: 8
  template:
    spec:
      containers:
        - name: test-job
          image: busybox
          command: ["echo", "test paralle job!"]
      restartPolicy: Never
```

```sh
kubectl apply -f para-demo.yaml
```

![image-20231102121002977](https://blog.tianch.com.cn/img/image-20231102121002977.png)

可以看到一次可以有2个 Pod 同时运行，需要8个 Pod 执行成功，如果不是8个成功，那么会根据 `restartPolicy` 的策略进行处理，可以认为是一种检查机制。

## CronJob

`CronJob` 其实就是在 `Job` 的基础上加上了时间调度，可以在给定的时间点运行一个任务，也可以周期性地在给定时间点运行。这个实际上和 Linux 中的 `crontab` 就非常类似了。

一个 `CronJob` 对象其实就对应中 `crontab` 文件中的一行，它根据配置的时间格式周期性地运行一个 `Job`，格式和 `crontab` 也是一样的。

crontab 的格式为：`分 时 日 月 星期 要运行的命令` 。

- 第1列分钟 0～59
- 第2列小时 0～23
- 第3列日 1～31
- 第4列月 1～12
- 第5列星期 0～7（0和7表示星期天）
- 第6列要运行的命令

用 `CronJob` 来管理我们上面的 `Job` 任务，定义如下所示的资源清单：_cronjob-demo.yaml_

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cronjob-demo
spec:
  schedule: "*/1 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: hello
              image: busybox
              command:
                - "bin/sh"
                - "-c"
                - "for i in 9 8 7 6 5 4 3 2 1; do echo $i; done"
          restartPolicy: OnFailure
```

这里的 Kind 变成了 `CronJob` 了，要注意的是 `spec.schedule` 字段是必须填写的，用来指定任务运行的周期，格式就和 `crontab` 一样，另外一个字段是 `.spec.jobTemplate`, 用来指定需要运行的任务，格式当然和 `Job` 是一致的。还有一些值得我们关注的字段 `.spec.successfulJobsHistoryLimit`(默认为3) 和 `.spec.failedJobsHistoryLimit`(默认为1)，表示历史限制，是可选的字段，指定可以保留多少完成和失败的 `Job`。然而，当运行一个 `CronJob` 时，`Job` 可以很快就堆积很多，所以一般推荐设置这两个字段的值，如果设置限制的值为 0，那么相关类型的 `Job` 完成后将不会被保留。

我们直接新建上面的资源对象：

```sh
kubectl apply -f cronjob-demo.yaml
```

稍微等一会儿查看可以发现多了几个 Job 资源对象，这个就是因为上面设置的 CronJob 资源对象，每1分钟执行一个新的 Job：

![image-20231102122757357](https://blog.tianch.com.cn/img/image-20231102122757357.png)

这个就是 CronJob 的基本用法，一旦不再需要 CronJob，可以使用 kubectl 命令删除它：

```shell
kubectl delete cronjob cronjob-demo
```

需要注意的是这将会终止正在创建的 Job，但是运行中的 Job 将不会被终止，不会删除 Job 或 它们的 Pod。

