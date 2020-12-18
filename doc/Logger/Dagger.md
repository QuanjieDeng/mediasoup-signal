Dagger ��һ������ Loki ����־��ѯ�͹���ϵͳ�������ɴ��˿Ƽ��� CloudMinds ���ŶӵĴ��������ʩƽ̨����������һ����Ŀ��Dagger ������ Loki ǰ�ˣ��߱���־��ѯ����������������ص����ԣ���������ԭ�������µ�������־��������

github��ַ
https://github.com/CloudmindsRobot/dagger



��װ
ǰ������ 
- һ����ȫ���õ� K8S���� 
- ������������  Loki  
	loki�Ĳ����ĵ����Բο�����ĵ�

����Դ�� git clone https://github.com/CloudmindsRobot/dagger.git
Դ���е� kubernetes/quickstart.yaml �����������K8S  �����ļ�
�޸�LokiԴ��ַ 

```
- name: LOKI_SERVER
  value: http://loki.infra:3100
```

���������ļ��� ��ʹ����PVC 
```
          volumeMounts:
            - mountPath: /usr/src/app/static
              name: static-data
            - mountPath: /usr/src/app/db
              name: sqlite-data
            - mountPath: /etc/dagger
              name: dagger-conf
      restartPolicy: Always
      serviceAccountName: ""
      volumes:
        - name: static-data
          persistentVolumeClaim:
            claimName: static-data
        - name: sqlite-data
          persistentVolumeClaim:
            claimName: sqlite-data
        - name: dagger-conf
          configMap:
            defaultMode: 420
            name: dagger-conf
```
��ʵ�ʵĲ���ʱ����е�����FS�������ȴ�����PVC
�ڲ���ʱ���û��PVC������ʱʹ�� �����������ķ�ʽ������ 
```
          volumeMounts:
            - mountPath: /usr/src/app/static
              name: static-data
            - mountPath: /usr/src/app/db
              name: sqlite-data
            - mountPath: /etc/dagger
              name: dagger-conf
      restartPolicy: Always
      serviceAccountName: ""
      volumes:
        - name: static-data
          hostPath:
            path: /tmp/static-data
        - name: sqlite-data
          hostPath:
            path: /tmp/sqlite-data
        - name: dagger-conf
          configMap:
            defaultMode: 420
            name: dagger-conf
```
Ȼ�󴴽�NS  
kubectl  create  ns   Dagger  
����
kubectl apply -f kubernetes/quickstart.yaml -n  Dagger

����ɹ�֮�����ǿ���ͨ��  dagger-ui ���SVC ���з��� 
Ĭ�ϴ����� dagger-ui��clusterIPģʽ����Ҫ���ingressʹ�ã��ڲ���ʱҲ��ֱ�ӵ���Ϊ NodePort��ʽ 
������� 
ʹ��˵��������ֱ�Ӳο�github��Ŀ��ҳ��˵���ĵ� 