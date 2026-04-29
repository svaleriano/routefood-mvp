# RouteFood MVP

Projeto de estudo para entrevista: um roteirizador simples de entregas inspirado em um problema logistico do iFood.

## Stack

- Python com FastAPI
- React simples via CDN
- Dados em JSON
- Leaflet com OpenStreetMap
- Distancia euclidiana

## Como rodar

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Abra:

```text
http://127.0.0.1:8000
```

## Como funciona

O backend carrega um restaurante e uma lista de pedidos a partir de `backend/data/orders.json`.

Ao chamar `POST /api/route`, a API usa uma heuristica gulosa:

1. Comeca no restaurante.
2. Avalia os pedidos pendentes.
3. Escolhe o proximo pedido com melhor pontuacao.
4. A pontuacao combina distancia euclidiana e prioridade.
5. Repete ate nao existirem pedidos pendentes.

A formula principal e:

```text
score = distancia_euclidiana - prioridade * peso_da_prioridade
```

Quanto menor o score, mais cedo o pedido entra na rota.

## O que explicar na entrevista

Eu desenvolvi um MVP para resolver um problema logistico parecido com um cenario do iFood: organizar a ordem de entregas a partir de um restaurante e varios pedidos.

Usei FastAPI para expor os dados e calcular a rota, React para permitir edicao dos pedidos, Leaflet para visualizar os pontos no mapa e JSON para manter o projeto simples e facil de demonstrar.

O algoritmo e uma heuristica gulosa. Ele nao garante a melhor rota global em todos os casos, mas entrega uma solucao rapida, facil de explicar e boa para um MVP. Para evoluir, eu poderia trocar a distancia euclidiana por tempo real de deslocamento, usar janelas de entrega, adicionar multiplos entregadores e comparar a heuristica com algoritmos como 2-opt.
