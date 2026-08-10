---
title: "Java常见性能问题定位"
published: 2020-07-08
description: "Java常见性能问题定位"
tags: ["Java"]
category: "Java"
draft: false
lang: zh_CN
---

Java常见性能问题定位

概述

性能优化一向是后端服务优化的重点，但是线上性能故障问题不是经常出现，或者受限于业务产品，根本就没办法出现性能问题，包括笔者自己遇到的性能问题也不多，所以为了提前储备知识，当出现问题的时候不会手忙脚乱，我们本篇文章来模拟下常见的几个Java性能故障，来学习怎么去分析和定位。

预备知识

既然是定位问题，肯定是需要借助工具，我们先了解下需要哪些工具可以帮忙定位问题。

**top命令**

`top`命令使我们最常用的Linux命令之一，它可以实时的显示当前正在执行的进程的CPU使用率，内存使用率等系统信息。`top -Hp pid` 可以查看线程的系统资源使用情况。

**vmstat命令**

vmstat是一个指定周期和采集次数的虚拟内存检测工具，可以统计内存，CPU，swap的使用情况，它还有一个重要的常用功能，用来观察进程的上下文切换。字段说明如下:

- r: 运行队列中进程数量（当数量大于CPU核数表示有阻塞的线程）

- b: 等待IO的进程数量

- swpd: 使用虚拟内存大小

- free: 空闲物理内存大小

- buff: 用作缓冲的内存大小(内存和硬盘的缓冲区)

- cache: 用作缓存的内存大小（CPU和内存之间的缓冲区）

- si: 每秒从交换区写到内存的大小，由磁盘调入内存

- so: 每秒写入交换区的内存大小，由内存调入磁盘

- bi: 每秒读取的块数

- bo: 每秒写入的块数

- in: 每秒中断数，包括时钟中断。

- cs: 每秒上下文切换数。

- us: 用户进程执行时间百分比(user time)

- sy: 内核系统进程执行时间百分比(system time)

- wa: IO等待时间百分比

- id: 空闲时间百分比

**pidstat命令**

pidstat 是 Sysstat 中的一个组件，也是一款功能强大的性能监测工具，`top` 和 `vmstat` 两个命令都是监测进程的内存、CPU 以及 I/O 使用情况，而 pidstat 命令可以检测到线程级别的。`pidstat`命令线程切换字段说明如下：

- 
UID ：被监控任务的真实用户ID。

- 
TGID ：线程组ID。

- 
TID：线程ID。

- 
cswch/s：主动切换上下文次数，这里是因为资源阻塞而切换线程，比如锁等待等情况。

- 
nvcswch/s：被动切换上下文次数，这里指CPU调度切换了线程。

**jstack命令**

jstack是JDK工具命令，它是一种线程堆栈分析工具，最常用的功能就是使用 `jstack pid` 命令查看线程的堆栈信息，也经常用来排除死锁情况。

**jstat 命令**

它可以检测Java程序运行的实时情况，包括堆内存信息和垃圾回收信息，我们常常用来查看程序垃圾回收情况。常用的命令是`jstat -gc pid`。信息字段说明如下：

- 
S0C：年轻代中 To Survivor 的容量（单位 KB）；

- 
S1C：年轻代中 From Survivor 的容量（单位 KB）；

- 
S0U：年轻代中 To Survivor 目前已使用空间（单位 KB）；

- 
S1U：年轻代中 From Survivor 目前已使用空间（单位 KB）；

- 
EC：年轻代中 Eden 的容量（单位 KB）；

- 
EU：年轻代中 Eden 目前已使用空间（单位 KB）；

- 
OC：老年代的容量（单位 KB）；

- 
OU：老年代目前已使用空间（单位 KB）；

- 
MC：元空间的容量（单位 KB）；

- 
MU：元空间目前已使用空间（单位 KB）；

- 
YGC：从应用程序启动到采样时年轻代中 gc 次数；

- 
YGCT：从应用程序启动到采样时年轻代中 gc 所用时间 (s)；

- 
FGC：从应用程序启动到采样时 老年代（Full Gc）gc 次数；

- 
FGCT：从应用程序启动到采样时 老年代代（Full Gc）gc 所用时间 (s)；

- 
GCT：从应用程序启动到采样时 gc 用的总时间 (s)。

**jmap命令**

jmap也是JDK工具命令，他可以查看堆内存的初始化信息以及堆内存的使用情况，还可以生成dump文件来进行详细分析。查看堆内存情况命令`jmap -heap pid`。

**mat内存工具**

MAT(Memory Analyzer Tool)工具是eclipse的一个插件(MAT也可以单独使用)，它分析大内存的dump文件时，可以非常直观的看到各个对象在堆空间中所占用的内存大小、类实例数量、对象引用关系、利用OQL对象查询，以及可以很方便的找出对象GC Roots的相关信息。

**idea中也有这么一个插件，就是JProfiler**。

相关阅读：

- 《性能诊断利器 JProfiler 快速入门和最佳实践》：https://segmentfault.com/a/1190000017795841

模拟环境准备

基础环境jdk1.8，采用SpringBoot框架来写几个接口来触发模拟场景，首先是模拟CPU占满情况

CPU占满

模拟CPU占满还是比较简单，直接写一个死循环计算消耗CPU即可。

```java
 	/**
     * 模拟CPU占满
     */
    @GetMapping("/cpu/loop")
    public void testCPULoop() throws InterruptedException {
        System.out.println("请求cpu死循环");
        Thread.currentThread().setName("loop-thread-cpu");
        int num = 0;
        while (true) {
            num++;
            if (num == Integer.MAX_VALUE) {
                System.out.println("reset");
            }
            num = 0;
        }

    }

```

请求接口地址测试`curl localhost:8080/cpu/loop`,发现CPU立马飙升到100%

![java-performance1](http://oss.tianch.xyz/img/java-performance1_1594191139391.png)

通过执行`top -Hp 32805` 查看Java线程情况

![java-performance2](http://oss.tianch.xyz/img/java-performance2_1594191139483.png)

执行 `printf '%x' 32826` 获取16进制的线程id，用于`dump`信息查询，结果为 `803a`。最后我们执行`jstack 32805 |grep -A 20 803a`来查看下详细的`dump`信息。

![java-performance3](http://oss.tianch.xyz/img/java-performance3_1594191140068.png)

这里`dump`信息直接定位出了问题方法以及代码行，这就定位出了CPU占满的问题。

内存泄露

模拟内存泄漏借助了ThreadLocal对象来完成，ThreadLocal是一个线程私有变量，可以绑定到线程上，在整个线程的生命周期都会存在，但是由于ThreadLocal的特殊性，ThreadLocal是基于ThreadLocalMap实现的，ThreadLocalMap的Entry继承WeakReference，而Entry的Key是WeakReference的封装，换句话说Key就是弱引用，弱引用在下次GC之后就会被回收，如果ThreadLocal在set之后不进行后续的操作，因为GC会把Key清除掉，但是Value由于线程还在存活，所以Value一直不会被回收，最后就会发生内存泄漏。

```Java
/**
     * 模拟内存泄漏
     */
    @GetMapping(value = "/memory/leak")
    public String leak() {
        System.out.println("模拟内存泄漏");
        ThreadLocal localVariable = new ThreadLocal();
        localVariable.set(new Byte[4096 * 1024]);// 为线程添加变量
        return "ok";
    }

```

我们给启动加上堆内存大小限制，同时设置内存溢出的时候输出堆栈快照并输出日志。

`java -jar -Xms500m -Xmx500m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heapdump.hprof -XX:+PrintGCTimeStamps -XX:+PrintGCDetails -Xloggc:/tmp/heaplog.log analysis-demo-0.0.1-SNAPSHOT.jar`

启动成功后我们循环执行100次,`for i in {1..500}; do curl localhost:8080/memory/leak;done`,还没执行完毕，系统已经返回500错误了。查看系统日志出现了如下异常：

```
java.lang.OutOfMemoryError: Java heap space

```

我们用`jstat -gc pid` 命令来看看程序的GC情况。

![java-performance4](http://oss.tianch.xyz/img/java-performance4_1594191139468.png)

很明显，内存溢出了，堆内存经过45次 Full Gc 之后都没释放出可用内存，这说明当前堆内存中的对象都是存活的，有GC Roots引用，无法回收。那是什么原因导致内存溢出呢？是不是我只要加大内存就行了呢？如果是普通的内存溢出也许扩大内存就行了，但是如果是内存泄漏的话，扩大的内存不一会就会被占满，所以我们还需要确定是不是内存泄漏。我们之前保存了堆 Dump 文件，这个时候借助我们的MAT工具来分析下。导入工具选择`Leak Suspects Report`，工具直接就会给你列出问题报告。

![java-performance5](http://oss.tianch.xyz/img/java-performance5_1594191142380.png)

这里已经列出了可疑的4个内存泄漏问题，我们点击其中一个查看详情。

![java-performance6](http://oss.tianch.xyz/img/java-performance6_1594191158773.png)

这里已经指出了内存被线程占用了接近50M的内存，占用的对象就是ThreadLocal。如果想详细的通过手动去分析的话，可以点击`Histogram`,查看最大的对象占用是谁，然后再分析它的引用关系，即可确定是谁导致的内存溢出。

![java-performance7](http://oss.tianch.xyz/img/java-performance7_1594191166766.png)

上图发现占用内存最大的对象是一个Byte数组，我们看看它到底被那个GC Root引用导致没有被回收。按照上图红框操作指引，结果如下图：

![java-performance8](http://oss.tianch.xyz/img/java-performance8_1594191173243.png)

我们发现Byte数组是被线程对象引用的，图中也标明，Byte数组对像的GC Root是线程，所以它是不会被回收的，展开详细信息查看，我们发现最终的内存占用对象是被ThreadLocal对象占据了。这也和MAT工具自动帮我们分析的结果一致。

死锁

死锁会导致耗尽线程资源，占用内存，表现就是内存占用升高，CPU不一定会飙升(看场景决定)，如果是直接new线程，会导致JVM内存被耗尽，报无法创建线程的错误，这也是体现了使用线程池的好处。

```java
 ExecutorService service = new ThreadPoolExecutor(4, 10,
            0, TimeUnit.SECONDS, new LinkedBlockingQueue(1024),
            Executors.defaultThreadFactory(),
            new ThreadPoolExecutor.AbortPolicy());
   /**
     * 模拟死锁
     */
    @GetMapping("/cpu/test")
    public String testCPU() throws InterruptedException {
        System.out.println("请求cpu");
        Object lock1 = new Object();
        Object lock2 = new Object();
        service.submit(new DeadLockThread(lock1, lock2), "deadLookThread-" + new Random().nextInt());
        service.submit(new DeadLockThread(lock2, lock1), "deadLookThread-" + new Random().nextInt());
        return "ok";
    }

public class DeadLockThread implements Runnable {
    private Object lock1;
    private Object lock2;

    public DeadLockThread1(Object lock1, Object lock2) {
        this.lock1 = lock1;
        this.lock2 = lock2;
    }

    @Override
    public void run() {
        synchronized (lock2) {
            System.out.println(Thread.currentThread().getName()+"get lock2 and wait lock1");
            try {
                TimeUnit.MILLISECONDS.sleep(2000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            synchronized (lock1) {
                System.out.println(Thread.currentThread().getName()+"get lock1 and lock2 ");
            }
        }
    }
}

```

我们循环请求接口2000次，发现不一会系统就出现了日志错误，线程池和队列都满了,由于我选择的当队列满了就拒绝的策略，所以系统直接抛出异常。

```
java.util.concurrent.RejectedExecutionException: Task java.util.concurrent.FutureTask@2760298 rejected from java.util.concurrent.ThreadPoolExecutor@7ea7cd51[Running, pool size = 10, active threads = 10, queued tasks = 1024, completed tasks = 846]

```

通过`ps -ef|grep java`命令找出 Java 进程 pid，执行`jstack pid` 即可出现java线程堆栈信息，这里发现了5个死锁，我们只列出其中一个，很明显线程`pool-1-thread-2`锁住了`0x00000000f8387d88`等待`0x00000000f8387d98`锁，线程`pool-1-thread-1`锁住了`0x00000000f8387d98`等待锁`0x00000000f8387d88`,这就产生了死锁。

```JAVA
Java stack information for the threads listed above:
===================================================
"pool-1-thread-2":
        at top.luozhou.analysisdemo.controller.DeadLockThread2.run(DeadLockThread.java:30)
        - waiting to lock  (a java.lang.Object)
        - locked  (a java.lang.Object)
        at java.util.concurrent.Executors$RunnableAdapter.call(Executors.java:511)
        at java.util.concurrent.FutureTask.run(FutureTask.java:266)
        at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1149)
        at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:624)
        at java.lang.Thread.run(Thread.java:748)
"pool-1-thread-1":
        at top.luozhou.analysisdemo.controller.DeadLockThread1.run(DeadLockThread.java:30)
        - waiting to lock  (a java.lang.Object)
        - locked  (a java.lang.Object)
        at java.util.concurrent.Executors$RunnableAdapter.call(Executors.java:511)
        at java.util.concurrent.FutureTask.run(FutureTask.java:266)
        at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1149)
        at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:624)
        at java.lang.Thread.run(Thread.java:748)
          
 Found 5 deadlocks.

```

线程频繁切换

上下文切换会导致将大量CPU时间浪费在寄存器、内核栈以及虚拟内存的保存和恢复上，导致系统整体性能下降。当你发现系统的性能出现明显的下降时候，需要考虑是否发生了大量的线程上下文切换。

```java
 @GetMapping(value = "/thread/swap")
    public String theadSwap(int num) {
        System.out.println("模拟线程切换");
        for (int i = 0; i 总结

本文模拟了常见的性能问题场景，分析了如何定位CPU100%、内存泄漏、死锁、线程频繁切换问题。分析问题我们需要做好两件事，第一，掌握基本的原理，第二，借助好工具。本文也列举了分析问题的常用工具和命令，希望对你解决问题有所帮助。当然真正的线上环境可能十分复杂，并没有模拟的环境那么简单，但是原理是一样的，问题的表现也是类似的，我们重点抓住原理，活学活用，相信复杂的线上问题也可以顺利解决。

参考

1、https://linux.die.net/man/1/pidstat

2、https://linux.die.net/man/8/vmstat

3、https://help.eclipse.org/2020-03/index.jsp?topic=/org.eclipse.mat.ui.help/welcome.html

4、https://www.linuxblogs.cn/articles/18120200.html

5、https://www.tutorialspoint.com/what-is-context-switching-in-operating-system

原文链接：https://snailclimb.gitee.io/javaguide/#/./docs/java/%E6%89%8B%E6%8A%8A%E6%89%8B%E6%95%99%E4%BD%A0%E5%AE%9A%E4%BD%8D%E5%B8%B8%E8%A7%81Java%E6%80%A7%E8%83%BD%E9%97%AE%E9%A2%98
