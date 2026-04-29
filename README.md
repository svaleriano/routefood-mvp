# RouteFood MVP

Projeto de estudo para entrevista: um roteirizador simples de entregas inspirado em um problema logistico do iFood.

## Stack

- Python com FastAPI
- React simples via CDN
- Dados em JSON
- Leaflet com OpenStreetMap
- Distancia euclidiana
- Busca de endereco por CEP com ViaCEP
- Geocodificacao do endereco com OpenStreetMap/Nominatim

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

Na interface, o usuario pode informar o CEP de um pedido. O frontend consulta a API publica do ViaCEP para preencher o endereco e usa o Nominatim, do ecossistema OpenStreetMap, para converter o endereco em latitude e longitude. Essas coordenadas continuam sendo usadas internamente para calcular a rota.

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

## Complexidade do algoritmo

O algoritmo utilizado e uma heuristica gulosa do tipo `nearest neighbor`, com um ajuste simples de prioridade.

Para cada parada da rota, o sistema percorre todos os pedidos ainda pendentes para escolher o melhor proximo destino. Como esse processo se repete ate todos os pedidos serem visitados, a complexidade de tempo e:

```text
O(n^2)
```

onde `n` e a quantidade de pedidos.

A complexidade de espaco e:

```text
O(n)
```

porque o sistema mantem uma lista de pedidos pendentes e uma lista de paradas calculadas.

Essa escolha e adequada para um MVP porque e simples, rapida para pequenos e medios volumes e facil de explicar. Para volumes maiores ou restricoes mais complexas, a solucao poderia evoluir para algoritmos como 2-opt, simulated annealing, algoritmos geneticos ou servicos especializados de roteirizacao.

## API

### `GET /api/health`

Verifica se a API esta ativa.

Resposta:

```json
{
  "status": "ok"
}
```

### `GET /api/orders`

Retorna o restaurante e os pedidos de exemplo carregados do arquivo JSON.

Resposta resumida:

```json
{
  "restaurant": {
    "id": "restaurante-central",
    "name": "Restaurante Central",
    "latitude": -23.561684,
    "longitude": -46.655981
  },
  "orders": [
    {
      "id": "PED-1001",
      "customer": "Ana Souza",
      "zip_code": "01310-200",
      "address": "Avenida Paulista, Bela Vista, Sao Paulo, SP",
      "latitude": -23.555225,
      "longitude": -46.639557,
      "priority": 3,
      "max_delivery_minutes": 30
    }
  ]
}
```

### `POST /api/route`

Calcula a ordem recomendada de entrega.

Payload:

```json
{
  "restaurant": {
    "id": "restaurante-central",
    "name": "Restaurante Central",
    "latitude": -23.561684,
    "longitude": -46.655981
  },
  "orders": [
    {
      "id": "PED-1001",
      "customer": "Ana Souza",
      "zip_code": "01310-200",
      "address": "Avenida Paulista, Bela Vista, Sao Paulo, SP",
      "latitude": -23.555225,
      "longitude": -46.639557,
      "priority": 3,
      "max_delivery_minutes": 30
    }
  ],
  "priority_weight": 0.015
}
```

Resposta:

```json
{
  "algorithm": "greedy_nearest_neighbor_with_priority",
  "total_distance": 0.017648,
  "stops": [
    {
      "order": {
        "id": "PED-1001",
        "customer": "Ana Souza",
        "priority": 3
      },
      "distance_from_previous": 0.017648,
      "accumulated_distance": 0.017648
    }
  ]
}
```

## Casos de borda

Alguns cenarios que o projeto considera ou deixa preparados para evolucao:

- Lista de pedidos vazia: a API retorna erro `400`, porque nao existe rota a ser calculada.
- CEP invalido ou inexistente: o frontend exibe uma mensagem de erro retornada pelo ViaCEP.
- Endereco sem coordenadas: o frontend informa que o endereco foi encontrado, mas nao possui coordenadas utilizaveis.
- Endereco sem CEP no Nominatim: o sistema ainda usa as coordenadas e informa que o CEP nao foi retornado.
- Prioridade fora do intervalo esperado: o backend valida prioridade entre `1` e `3` com Pydantic.
- Dados incompletos de latitude/longitude: a validacao do FastAPI/Pydantic impede o calculo com payload inconsistente.
- Crescimento da quantidade de pedidos: o algoritmo atual tem complexidade `O(n^2)`, aceitavel para MVP, mas nao ideal para grande escala.

## Limitacoes conhecidas

- A distancia euclidiana nao representa a distancia real nas ruas.
- O projeto nao considera transito, tempo de preparo, capacidade do entregador ou multiplos entregadores.
- A geocodificacao depende de APIs publicas externas, como ViaCEP e Nominatim.
- O algoritmo nao garante a melhor rota global, apenas uma boa rota aproximada para demonstracao.

## O que explicar na entrevista

Eu desenvolvi um MVP para resolver um problema logistico parecido com um cenario do iFood: organizar a ordem de entregas a partir de um restaurante e varios pedidos.

Usei FastAPI para expor os dados e calcular a rota, React para permitir edicao dos pedidos, ViaCEP para buscar endereco pelo CEP, Leaflet para visualizar os pontos no mapa e JSON para manter o projeto simples e facil de demonstrar.

O algoritmo e uma heuristica gulosa. Ele nao garante a melhor rota global em todos os casos, mas entrega uma solucao rapida, facil de explicar e boa para um MVP. Para evoluir, eu poderia trocar a distancia euclidiana por tempo real de deslocamento, usar janelas de entrega, adicionar multiplos entregadores e comparar a heuristica com algoritmos como 2-opt.
