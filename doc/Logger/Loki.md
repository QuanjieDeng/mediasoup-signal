## ���

Loki�� Grafana Labs �Ŷ����µĿ�Դ��Ŀ����һ��ˮƽ����չ���߿����ԣ����⻧����־�ۺ�ϵͳ��������Ʒǳ����ø�Ч�����ڲ�������Ϊ������Ϊ��־���ݱ�������������Ϊÿ����־������һ���ǩ����Ŀ�� Prometheus �������ٷ��Ľ��ܾ��ǣ�Like Prometheus, but for logs.�������� Prometheus ����־ϵͳ��

github��ַ   https://github.com/grafana/loki

## ��װ 
Loki�����Ҫ�ֳ��������� 
loki��������������洢��־�ʹ����ѯ 
promtail ��רΪLoki���ƵĴ��������ռ���־�����͸�loki

Loki�ṩ�˷ǳ���İ�װ��ʽ,����Ŀ��Բο��ĵ� ��������ܵ���ʹ��helm���а�װ 

���helmԴ
helm repo add loki https://grafana.github.io/loki/charts
helm repo update

��װĬ������ 
helm upgrade --install loki loki/loki-stack  ͨ�����ַ�ʽһ���ԾͰ�װ��  loki+promtail

## ���� 
- loki�������ļ���cmd/loki�ļ�������,�����������ļ� 
```
loki-local-config.yaml   ��Ҫ���������ز���ʱʹ�� 
loki-docker-config.yaml   ��Ҫʱ��Ϊ��������ʱʹ�� 

```

- promtail��������cmd/promtail��ͬ��Ҳ�������������ļ�
```
promtail-docker-config.yaml
promtail-local-config.yaml
```
���е�������ǿ���ֱ��ͨ�������������õģ����������Ҫ

## ����node�׺��� 
����ΪʲôҪ˵�׺��ԣ���Ϊ promtail��K8S�еĲ�������Ϊ DaemoSet������ζ�������ڼ�Ⱥ������node������,
��ʵ�ʵ�������ܲ����������������ʹ�ù�˾��K8S��Ⱥ������Ҫ�����е�node������ֻ��Ҫ�������������node���������ɣ�

��ʱ��Ϳ���ʹ���ϸ��node�׺��ԣ���ֻ֤����ص�node������ 