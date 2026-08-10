---
title: "事务的传播行为"
published: 2021-07-02
description: "事务传播行为用来描述由某一个事务传播行为修饰的方法被嵌套进另一个方法的时事务如何传播。"
tags: ["运维"]
category: "其他"
draft: false
lang: zh_CN
---

1.什么是事务传播行为？

事务传播行为用来描述由某一个事务传播行为修饰的方法被嵌套进另一个方法的时事务如何传播。

即然是传播，那么至少有两个东西，才可以发生传播。单体不存在传播这个行为。

事务传播行为（propagation behavior）指的就是当一个事务方法被另一个事务方法调用时，这个事务方法应该如何进行。

```java
public void methodA(){
    methodB();
    //doSomething
}
 
@Transaction(Propagation=XXX)
public void methodB(){
    //doSomething
}

```

代码中`methodA()`方法嵌套调用了`methodB()`方法，`methodB()`的事务传播行为由`@Transaction(Propagation=XXX)`设置决定。这里需要注意的是`methodA()`并没有开启事务，某一个事务传播行为修饰的方法并不是必须要在开启事务的外围方法中调用。

2. Spring中七种事务传播行为

事务传播行为类型说明

PROPAGATION_REQUIRED如果当前没有事务，就新建一个事务，如果已经存在一个事务中，加入到这个事务中。这也是默认的传播行为。
PROPAGATION_SUPPORTS支持当前事务，如果当前没有事务，就以非事务方式执行。
PROPAGATION_MANDATORY使用当前的事务，如果当前没有事务，就抛出异常。
PROPAGATION_REQUIRES_NEW新建事务，如果当前存在事务，把当前事务挂起。
PROPAGATION_NOT_SUPPORTED以非事务方式执行操作，如果当前存在事务，就把当前事务挂起。
PROPAGATION_NEVER以非事务方式执行，如果当前存在事务，则抛出异常。
PROPAGATION_NESTED如果当前存在事务，则在嵌套事务内执行。如果当前没有事务，则执行与PROPAGATION_REQUIRED类似的操作。

3.验证

准备工作

- 
创建表

```mysql
CREATE TABLE `user1` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(45) NOT NULL DEFAULT '',
  PRIMARY KEY(`id`)
)
ENGINE = InnoDB;

CREATE TABLE `user2` (
  `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(45) NOT NULL DEFAULT '',
  PRIMARY KEY(`id`)
)
ENGINE = InnoDB;

```

- 
实体类

```java
public class User1 {
    private Integer id;
    private String name;
   //get和set方法省略...
}

public class User2 {
    private Integer id;
    private String name;
   //get和set方法省略...
}

```

- 
Mapper类

```java
public interface User1Mapper {
    int insert(User1 record);
    User1 selectByPrimaryKey(Integer id);
    //其他方法省略...
}

public interface User2Mapper {
    int insert(User2 record);
    User2 selectByPrimaryKey(Integer id);
    //其他方法省略...
}

```

1.PROPAGATION_REQUIRED   (抛出的异常一定得是运行时异常)

```java
@Service
public class User1ServiceImpl implements User1Service {
    //省略其他...
    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public void addRequired(User1 user){
        user1Mapper.insert(user);
    }
}

@Service
public class User2ServiceImpl implements User2Service {
    //省略其他...
    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public void addRequired(User2 user){
        user2Mapper.insert(user);
    }
    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public void addRequiredException(User2 user){
        user2Mapper.insert(user);

        throw new RuntimeException();
    }

}

```

1.1 外围方法不开启事务

验证方法1:

```java
@Override
public void notransaction_exception_required_required(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addRequired(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addRequired(user2);

    throw new RuntimeException();
}

```

验证方法2:

```java
@Override
public void notransaction_required_required_exception(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addRequired(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addRequiredException(user2);
}

```

结果 :

验证方法序号数据库结果结果分析

1“张三”、“李四”均插入。外围方法未开启事务，插入“张三”、“李四”方法在自己的事务中独立运行，外围方法异常不影响内部插入“张三”、“李四”方法独立的事务。
2“张三”插入，“李四”未插入。外围方法没有事务，插入“张三”、“李四”方法都在自己的事务中独立运行,所以插入“李四”方法抛出异常只会回滚插入“李四”方法，插入“张三”方法不受影响。

**结论：通过这两个方法我们证明了在外围方法未开启事务的情况下`Propagation.REQUIRED`修饰的内部方法会新开启自己的事务，且开启的事务相互独立，互不干扰。**

1.2 外围方法开启事务

验证方法1:

```java
@Override
@Transactional(propagation = Propagation.REQUIRED)
public void transaction_exception_required_required(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addRequired(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addRequired(user2);

    throw new RuntimeException();
}

```

验证方法2:

```java
@Override
@Transactional(propagation = Propagation.REQUIRED)
public void transaction_required_required_exception(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addRequired(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addRequiredException(user2);
}

```

验证方法3:

```java
@Transactional
@Override
public void transaction_required_required_exception_try(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addRequired(user1);

    User2 user2=new User2();
    user2.setName("李四");
    try {
        user2Service.addRequiredException(user2);
    } catch (Exception e) {
        System.out.println("方法回滚");
    }
}

```

结果:

验证方法序号数据库结果结果分析

1“张三”、“李四”均未插入。外围方法开启事务，内部方法加入外围方法事务，外围方法回滚，内部方法也要回滚。
2“张三”、“李四”均未插入。外围方法开启事务，内部方法加入外围方法事务，内部方法抛出异常回滚，外围方法感知异常致使整体事务回滚。
3“张三”、“李四”均未插入。外围方法开启事务，内部方法加入外围方法事务，内部方法抛出异常回滚，即使方法被catch不被外围方法感知，因为使用的是同一个事务,整个事务依然回滚。

**结论：以上试验结果我们证明在外围方法开启事务的情况下`Propagation.REQUIRED`修饰的内部方法会加入到外围方法的事务中，所有`Propagation.REQUIRED`修饰的内部方法和外围方法均属于同一事务，只要一个方法回滚，整个事务均回滚。**

2.PROPAGATION_REQUIRES_NEW

```java
@Service
public class User1ServiceImpl implements User1Service {
    //省略其他...
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void addRequiresNew(User1 user){
        user1Mapper.insert(user);
    }
}

```

```java
@Service
public class User2ServiceImpl implements User2Service {
    //省略其他...
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void addRequiresNew(User2 user){
        user2Mapper.insert(user);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void addRequiresNewException(User2 user){
        user2Mapper.insert(user);
        throw new RuntimeException();
    }
}

```

2.1 外围方法不开启事务

验证方法1:

```java
@Override
public void notransaction_exception_requiresNew_requiresNew(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addRequiresNew(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addRequiresNew(user2);

    throw new RuntimeException();

}

```

验证方法2:

```java
@Override
public void notransaction_requiresNew_requiresNew_exception(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addRequiresNew(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addRequiresNewException(user2);
}

```

结果：

验证方法序号数据库结果结果分析

1“张三”插入，“李四”插入。外围方法没有事务，插入“张三”、“李四”方法都在自己的事务中独立运行,外围方法抛出异常回滚不会影响内部方法。
2“张三”插入，“李四”未插入外围方法没有开启事务，插入“张三”方法和插入“李四”方法分别开启自己的事务，插入“李四”方法抛出异常回滚，其他事务不受影响。

**结论：通过这两个方法我们证明了在外围方法未开启事务的情况下`Propagation.REQUIRES_NEW`修饰的内部方法会新开启自己的事务，且开启的事务相互独立，互不干扰。**

2.2 外围方法开启事务

验证方法1:

```java
@Override
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void transaction_exception_required_requiresNew_requiresNew(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addRequired(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addRequiresNew(user2);

    User2 user3=new User2();
    user3.setName("王五");
    user2Service.addRequiresNew(user3);

    throw new RuntimeException();
}

```

验证方法2:

```java
@Override
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void transaction_required_requiresNew_requiresNew_exception(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addRequired(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addRequiresNew(user2);

    User2 user3=new User2();
    user3.setName("王五");
    user2Service.addRequiresNewException(user3);
}

```

验证方法3:

```java
@Override
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void transaction_required_requiresNew_requiresNew_exception_try(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addRequired(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addRequiresNew(user2);

    User2 user3=new User2();
    user3.setName("王五");
    try {
        user2Service.addRequiresNewException(user3);
    } catch (Exception e) {
        System.out.println("回滚");
    }
}

```

结果：

验证方法序号数据库结果结果分析

1“张三”未插入，“李四”插入，“王五”插入。外围方法开启事务，插入“张三”方法和外围方法一个事务，插入“李四”方法、插入“王五”方法分别在独立的新建事务中，外围方法抛出异常只回滚和外围方法同一事务的方法，故插入“张三”的方法回滚。
2“张三”未插入，“李四”插入，“王五”未插入。外围方法开启事务，插入“张三”方法和外围方法一个事务，插入“李四”方法、插入“王五”方法分别在独立的新建事务中。插入“王五”方法抛出异常，首先插入 “王五”方法的事务被回滚，异常继续抛出被外围方法感知，外围方法事务亦被回滚，故插入“张三”方法也被回滚。
3“张三”插入，“李四”插入，“王五”未插入。外围方法开启事务，插入“张三”方法和外围方法一个事务，插入“李四”方法、插入“王五”方法分别在独立的新建事务中。插入“王五”方法抛出异常，首先插入“王五”方法的事务被回滚，异常被catch不会被外围方法感知，外围方法事务不回滚，故插入“张三”方法插入成功。

**结论：在外围方法开启事务的情况下`Propagation.REQUIRES_NEW`修饰的内部方法依然会单独开启独立事务，且与外部方法事务也独立，内部方法之间、内部方法和外部方法事务均相互独立，互不干扰。**

3.PROPAGATION_NESTED

```java
@Service
public class User1ServiceImpl implements User1Service {
    //省略其他...
    @Override
    @Transactional(propagation = Propagation.NESTED)
    public void addNested(User1 user){
        user1Mapper.insert(user);
    }
}

```

```java
@Service
public class User2ServiceImpl implements User2Service {
    //省略其他...
    @Override
    @Transactional(propagation = Propagation.NESTED)
    public void addNested(User2 user){
        user2Mapper.insert(user);
    }

    @Override
    @Transactional(propagation = Propagation.NESTED)
    public void addNestedException(User2 user){
        user2Mapper.insert(user);
        throw new RuntimeException();
    }
}

```

3.1 外围方法不开启事务

验证方法1:

```java
@Override
public void notransaction_exception_nested_nested(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addNested(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addNested(user2);

    throw new RuntimeException();
}

```

验证方法2:

```java
@Override
public void notransaction_nested_nested_exception(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addNested(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addNestedException(user2);
}

```

结果：

验证方法序号数据库结果结果分析

1“张三”、“李四”均插入。外围方法未开启事务，插入“张三”、“李四”方法在自己的事务中独立运行，外围方法异常不影响内部插入“张三”、“李四”方法独立的事务。
2“张三”插入，“李四”未插入。外围方法没有事务，插入“张三”、“李四”方法都在自己的事务中独立运行,所以插入“李四”方法抛出异常只会回滚插入“李四”方法，插入“张三”方法不受影响。

**结论：通过这两个方法我们证明了在外围方法未开启事务的情况下`Propagation.NESTED`和`Propagation.REQUIRED`作用相同，修饰的内部方法都会新开启自己的事务，且开启的事务相互独立，互不干扰。**

3.2 外围方法开启事务

验证方法1:

```java
@Transactional(propagation = Propagation.NESTED)
@Override
public void transaction_exception_nested_nested(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addNested(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addNested(user2);

    throw new RuntimeException();
}

```

验证方法2:

```java
@Transactional(propagation = Propagation.NESTED)
@Override
public void transaction_nested_nested_exception(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addNested(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addNestedException(user2);
}

```

验证方法3:

```java
@Transactional(propagation = Propagation.NESTED)
@Override
public void transaction_nested_nested_exception_try(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addNested(user1);

    User2 user2=new User2();
    user2.setName("李四");
    try {
        user2Service.addNestedException(user2);
    } catch (Exception e) {
        System.out.println("方法回滚");
    }
}

```

结果：

验证方法序号数据库结果结果分析

1“张三”、“李四”均未插入。外围方法开启事务，内部事务为外围事务的子事务，外围方法回滚，内部方法也要回滚。
2“张三”、“李四”均未插入。外围方法开启事务，内部事务为外围事务的子事务，内部方法抛出异常回滚，且外围方法感知异常致使整体事务回滚。
3“张三”插入、“李四”未插入。外围方法开启事务，内部事务为外围事务的子事务，插入“李四”内部方法抛出异常，可以单独对子事务回滚。

**结论：以上试验结果我们证明在外围方法开启事务的情况下`Propagation.NESTED`修饰的内部方法属于外部事务的子事务，外围主事务回滚，子事务一定回滚，而内部子事务可以单独回滚而不影响外围主事务和其他子事务**

4.PROPAGATION_MANDATORY

```java
@Service
public class User1ServiceImpl implements User1Service {
	//省略其他...
    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void addMandatory(User1 user) {
        user1Mapper.insert(user);
    }
}

```

```java
@Service
public class User2ServiceImpl implements User2Service {
	//省略其他...
    @Override
    public void addMandatory(User2 user) {
        user2Mapper.insert(user);
    }
}

```

4.1 外围方法不开启事务

验证方法1:

```java
  @Override
  public void notransaction_mandatory() {
      User1 user1 = new User1();
      user1.setName("张三");
      user1Service.addMandatory(user1);
  
      User2 user2 = new User2();
      user2.setName("李四");
      user2Service.addMandatory(user2);
  }

```

4.2 外围方法开启事务

验证方法2:

```java
  @Override
  @Transactional
  public void transaction_mandatory() {
      User1 user1 = new User1();
      user1.setName("张三");
      user1Service.addMandatory(user1);
      User2 user2 = new User2();
      user2.setName("李四");
      user2Service.addMandatory(user2);
  }

```

结果：

验证方法序号数据库结果结果分析

1“张三”、“李四”均未插入。外围方法没有开启事务,张三设置成MANDATORY,李四未设置,李四报异常:org.springframework.transaction.IllegalTransactionStateException: No existing transaction found for transaction marked with propagation 'mandatory' 不能正常插入,受异常影响,张三也不能插入
2“张三”、“李四”均插入。外围方法开启事务，且传播行为不能是PROPAGATION_MANDATORY ,数据都可以正常插入

**结论：外围方法调用开启了PROPAGATION_MANDATORY的方法时,自身必须开启事务,且自身事务的传播行为不能是PROPAGATION_MANDATORY,否则会报异常**

5.PROPAGATION_NEVER

```java
  @Service
  public class User1ServiceImpl implements User1Service {
  	//省略其他...
      @Override
      public void addNever(User1 user) {
          user1Mapper.insert(user);
      }
  }

```

```java
  @Service
  public class User2ServiceImpl implements User2Service {
  	//省略其他...
      @Override
      @Transactional(propagation = Propagation.NEVER)
      public void addNever(User2 user) {
          user2Mapper.insert(user);
      }
  }

```

5.1 外围方法不开启事务

验证方法1:

```java
@Override
public void notransaction_never() {
    User1 user1 = new User1();
    user1.setName("张三");
    user1Service.addNever(user1);

    User2 user2 = new User2();
    user2.setName("李四");
    user2Service.addNever(user2);
}

```

5.2 外围方法开启事务

验证方法2:

```java
@Override
@Transactional
public void transaction_never() {
    User1 user1 = new User1();
    user1.setName("张三");
    user1Service.addNever(user1);
    
    User2 user2 = new User2();
    user2.setName("李四");
    user2Service.addNever(user2);
}

```

结果：

验证方法序号数据库结果结果分析

1“张三”、“李四”均插入。外围方法没有开启事务,数据正常插入
2“张三”、“李四”均未插入。外围方法开启事务，李四的传播行为是NEVER,报异常org.springframework.transaction.IllegalTransactionStateException: Existing transaction found for transaction marked with propagation 'never',李四不能插入,受异常影响,张三也不能插入

**结论：开启了事务的方法不能调用开启PROPAGATION_NEVER的方法,否则会报异常**

6.PROPAGATION_SUPPORTS

```java
@Service
public class User1ServiceImpl implements User1Service {
    //省略其他...
    @Override
    @Transactional(propagation = Propagation.SUPPORTS)
    public void addSupports(User1 user) {
        user1Mapper.insert(user);
    }
}

@Service
public class User2ServiceImpl implements User2Service {
    //省略其他...
    @Override
    @Transactional(propagation = Propagation.SUPPORTS)
    public void addSupports(User2 user) {
        user2Mapper.insert(user);
    }

    @Override
    @Transactional(propagation = Propagation.SUPPORTS)
    public void addSupportsException(User2 user) {
        user2Mapper.insert(user);
        throw new RuntimeException();
    }
    
}

```

6.1 外围方法不开启事务

验证方法1:

```java
@Override
public void notransaction_exception_supports_supports() {
    User1 user1 = new User1();
    user1.setName("张三");
    user1Service.addSupports(user1);

    User2 user2 = new User2();
    user2.setName("李四");
    user2Service.addSupports(user2);

    throw new RuntimeException();
}

```

验证方法2:

```java
@Override
public void notransaction_supports_supports_exception() {
    User1 user1 = new User1();
    user1.setName("张三");
    user1Service.addSupports(user1);

    User2 user2 = new User2();
    user2.setName("李四");
    user2Service.addSupportsException(user2);
}

```

结果 :

验证方法序号数据库结果结果分析

1“张三”、“李四”均插入。外围方法未开启事务，则插入“张三”、“李四”方法以无事务方式运行，外围方法异常不影响内部插入
2“张三”、“李四”均插入。外围方法未开启事务，则插入“张三”、“李四”方法以无事务方式运行,内部异常没有事务李四也不会回滚

**结论：通过这两个方法我们证明了在外围方法未开启事务的情况下`Propagation.SUPPORTS`修饰的内部方法会以非事务的方式运行，插入成功后出现异常，数据不会因异常回滚**

6.2 外围方法开启事务

验证方法1:

```java
@Override
@Transactional
public void transaction_exception_supports_supports(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addSupports(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addSupports(user2);

    throw new RuntimeException();
}

```

验证方法2:

```java
@Override
@Transactional
public void transaction_supports_supports_exception(){
    User1 user1 = new User1();
    user1.setName("张三");
    user1Service.addSupports(user1);

    User2 user2 = new User2();
    user2.setName("李四");
    user2Service.addSupportsException(user2);
}

```

验证方法3:

```java
@Transactional
@Override
public void transaction_supports_supports_exception_try(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addSupports(user1);

    User2 user2=new User2();
    user2.setName("李四");
    try {
        user2Service.addSupportsException(user2);
    } catch (Exception e) {
        System.out.println("方法回滚");
    }
}

```

结果:

验证方法序号数据库结果结果分析

1“张三”、“李四”均未插入。外围方法开启事务，内部方法支持当前事务，外围方法回滚，内部方法也要回滚。
2“张三”、“李四”均未插入。外围方法开启事务，内部方法支持当前事务，内部方法抛出异常回滚，外围方法感知异常致使整体事务回滚。
3“张三”、“李四”均未插入。外围方法开启事务，内部方法加入外围方法事务，内部方法抛出异常回滚，即使方法被catch不被外围方法感知，因为使用的是同一个事务,整个事务依然回滚。

**结论：以上试验结果我们证明在外围方法开启事务的情况下`Propagation.SUPPORTS`修饰的内部方法会加入到外围方法的事务中，所有`Propagation.SUPPORTS`修饰的内部方法和外围方法均属于同一事务，只要一个方法回滚，整个事务均回滚。**

7.PROPAGATION_NOT_SUPPORTED

```java
@Service
public class User1ServiceImpl implements User1Service {
    //省略其他...
    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void addNotSupported(User1 user) {
        user1Mapper.insert(user);
    }
}

@Service
public class User2ServiceImpl implements User2Service {
    //省略其他...
    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void addNotSupported(User2 user) {
        user2Mapper.insert(user);
    }

    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void addNotSupportedException(User2 user) {
        user2Mapper.insert(user);
        throw new RuntimeException();
    }
    
}

```

7.1 外围方法不开启事务

验证方法1:

```java
@Override
public void notransaction_exception_notSupported_notSupported() {
    User1 user1 = new User1();
    user1.setName("张三");
    user1Service.addNotSupported(user1);
    
    User2 user2 = new User2();
    user2.setName("李四");
    user2Service.addNotSupported(user2);
    
    throw new RuntimeException();
}

```

验证方法2:

```java
@Override
public void notransaction_supports_supports_exception() {
    User1 user1 = new User1();
    user1.setName("张三");
    user1Service.addSupports(user1);

    User2 user2 = new User2();
    user2.setName("李四");
    user2Service.addSupportsException(user2);
}

```

结果 :

验证方法序号数据库结果结果分析

1“张三”、“李四”均插入。外围方法未开启事务，外围方法异常不影响内部插入
2“张三”、“李四”均插入。外围方法未开启事务，内部异常没有事务李四也不会回滚

**结论：通过这两个方法我们证明了在外围方法未开启事务的情况下`Propagation.NOT_SUPPORTED`修饰的内部方法没有事务可挂起也会以没有事务的方式运行，插入成功后出现异常，数据不会因异常回滚**

7.2 外围方法开启事务

验证方法1:

```java
@Override
@Transactional
public void transaction_exception_supports_supports(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addSupports(user1);

    User2 user2=new User2();
    user2.setName("李四");
    user2Service.addSupports(user2);

    throw new RuntimeException();
}

```

验证方法2:

```java
@Override
@Transactional
public void transaction_supports_supports_exception(){
    User1 user1 = new User1();
    user1.setName("张三");
    user1Service.addSupports(user1);

    User2 user2 = new User2();
    user2.setName("李四");
    user2Service.addSupportsException(user2);
}

```

验证方法3:

```java
@Transactional
@Override
public void transaction_supports_supports_exception_try(){
    User1 user1=new User1();
    user1.setName("张三");
    user1Service.addSupports(user1);

    User2 user2=new User2();
    user2.setName("李四");
    try {
        user2Service.addSupportsException(user2);
    } catch (Exception e) {
        System.out.println("方法回滚");
    }
}

```

结果:

验证方法序号数据库结果结果分析

1“张三”、“李四”均插入。外围方法开启事务，内部方法挂起当前事务，外围方法异常不影响内部插入
2“张三”、“李四”均插入。外围方法开启事务，内部方法挂起当前事务，外围方法异常不影响内部插入，内部异常没有事务李四也不会回滚
3“张三”、“李四”均插入。外围方法开启事务，内部方法挂起当前事务，李四没有事务,李四方法抛出异常也不会回滚

**结论：以上试验结果我们证明在外围方法开启事务的情况下`Propagation.NOT_SUPPORTED`修饰的内部方法会挂起外围方法的事务中，所有`Propagation.NOT_SUPPORTED`修饰的内部方法会以没有事务的方式运行，即使发生了异常也不会回滚。**

参考文章

源码地址
