const { useEffect, useMemo, useState } = React;

const api = {
  async getOrders() {
    const response = await fetch("/api/orders");
    if (!response.ok) throw new Error("Nao foi possivel carregar os pedidos.");
    return response.json();
  },
  async calculateRoute(payload) {
    const response = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Nao foi possivel calcular a rota.");
    return response.json();
  },
};

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

function formatAddressFromCep(data) {
  return [data.logradouro, data.bairro, data.localidade, data.uf]
    .filter(Boolean)
    .join(", ");
}

async function fetchAddressByCep(zipCode) {
  const cleanZipCode = onlyDigits(zipCode);
  if (cleanZipCode.length !== 8) {
    throw new Error("Informe um CEP com 8 digitos.");
  }

  const response = await fetch(`https://viacep.com.br/ws/${cleanZipCode}/json/`);
  if (!response.ok) throw new Error("Nao foi possivel buscar o CEP.");

  const data = await response.json();
  if (data.erro) throw new Error("CEP nao encontrado.");

  return {
    zip_code: cleanZipCode.replace(/^(\d{5})(\d{3})$/, "$1-$2"),
    address: formatAddressFromCep(data),
  };
}

async function geocodeAddress(address) {
  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
    countrycodes: "br",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!response.ok) throw new Error("Nao foi possivel localizar o endereco no mapa.");

  const results = await response.json();
  if (!results.length) throw new Error("Endereco encontrado, mas sem coordenadas.");

  return {
    latitude: Number(results[0].lat),
    longitude: Number(results[0].lon),
  };
}

function App() {
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [route, setRoute] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [priorityWeight, setPriorityWeight] = useState(0.015);
  const [status, setStatus] = useState("Carregando pedidos...");
  const [lookupStatus, setLookupStatus] = useState("");

  useEffect(() => {
    api
      .getOrders()
      .then((data) => {
        setRestaurant(data.restaurant);
        setOrders(data.orders);
        setStatus("Pedidos carregados.");
      })
      .catch((error) => setStatus(error.message));
  }, []);

  useEffect(() => {
    if (!restaurant || orders.length === 0) return;

    api
      .calculateRoute({ restaurant, orders, priority_weight: priorityWeight })
      .then((data) => {
        setRoute(data);
        setStatus("Rota calculada.");
      })
      .catch((error) => setStatus(error.message));
  }, [restaurant, orders, priorityWeight]);

  useEffect(() => {
    if (!restaurant || orders.length === 0 || !window.L) return;

    const map = L.map("map", { zoomControl: false }).setView(
      [restaurant.latitude, restaurant.longitude],
      13
    );

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      keepBuffer: 4,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const restaurantIcon = L.divIcon({
      className: "pin pin-restaurant",
      html: "R",
      iconSize: [30, 30],
    });

    const orderIcon = (priority) =>
      L.divIcon({
        className: `pin pin-priority-${priority}`,
        html: String(priority),
        iconSize: [28, 28],
      });

    const markers = [
      L.marker([restaurant.latitude, restaurant.longitude], { icon: restaurantIcon })
        .bindPopup(`<strong>${restaurant.name}</strong>`)
        .addTo(map),
    ];

    orders.forEach((order) => {
      markers.push(
        L.marker([order.latitude, order.longitude], { icon: orderIcon(order.priority) })
          .bindPopup(`<strong>${order.id}</strong><br />${order.customer}`)
          .addTo(map)
      );
    });

    if (route?.stops?.length) {
      const routePoints = [
        [restaurant.latitude, restaurant.longitude],
        ...route.stops.map(({ order }) => [order.latitude, order.longitude]),
      ];
      L.polyline(routePoints, { color: "#ea1d2c", weight: 4, opacity: 0.9 }).addTo(map);
      map.fitBounds(routePoints, { padding: [40, 40] });
    }

    map.whenReady(() => map.invalidateSize());
    window.setTimeout(() => map.invalidateSize(), 250);
    window.setTimeout(() => map.invalidateSize(), 750);

    return () => map.remove();
  }, [restaurant, orders, route]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId),
    [orders, selectedOrderId]
  );

  function updateOrder(orderId, field, value) {
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              [field]:
                field === "customer" || field === "zip_code" || field === "address"
                  ? value
                  : Number.parseFloat(value) || Number(value),
            }
          : order
      )
    );
  }

  function addOrder() {
    const nextNumber = orders.length + 1001;
    const newOrder = {
      id: `PED-${nextNumber}`,
      customer: "Novo cliente",
      zip_code: "",
      address: "",
      latitude: restaurant.latitude + 0.01,
      longitude: restaurant.longitude + 0.01,
      priority: 1,
      max_delivery_minutes: 45,
    };
    setOrders((currentOrders) => [...currentOrders, newOrder]);
    setSelectedOrderId(newOrder.id);
  }

  function removeSelectedOrder() {
    if (!selectedOrderId) return;
    setOrders((currentOrders) =>
      currentOrders.filter((order) => order.id !== selectedOrderId)
    );
    setSelectedOrderId(null);
  }

  async function fillAddressFromCep() {
    if (!selectedOrder) return;

    try {
      setLookupStatus("Buscando endereco...");
      const addressData = await fetchAddressByCep(selectedOrder.zip_code || "");
      setLookupStatus("Localizando no mapa...");
      const coordinates = await geocodeAddress(addressData.address);

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === selectedOrder.id
            ? {
                ...order,
                ...addressData,
                ...coordinates,
              }
            : order
        )
      );
      setLookupStatus("Endereco e coordenadas atualizados.");
    } catch (error) {
      setLookupStatus(error.message);
    }
  }

  async function locateTypedAddress() {
    if (!selectedOrder) return;

    try {
      setLookupStatus("Localizando endereco digitado...");
      const coordinates = await geocodeAddress(selectedOrder.address || "");

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === selectedOrder.id
            ? {
                ...order,
                zip_code: order.zip_code || "Nao informado",
                ...coordinates,
              }
            : order
        )
      );
      setLookupStatus("Endereco localizado no mapa.");
    } catch (error) {
      setLookupStatus(error.message);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">RouteFood MVP</p>
            <h1>Roteirizacao de entregas</h1>
          </div>
          <div className="metric">
            <span>Distancia total</span>
            <strong>{route ? route.total_distance.toFixed(4) : "0.0000"}</strong>
          </div>
        </header>

        <div className="content-grid">
          <aside className="panel">
            <div className="panel-header">
              <h2>Pedidos</h2>
              <button onClick={addOrder}>Adicionar</button>
            </div>

            <label className="field">
              Peso da prioridade
              <input
                type="range"
                min="0"
                max="0.04"
                step="0.005"
                value={priorityWeight}
                onChange={(event) => setPriorityWeight(Number(event.target.value))}
              />
              <span>{priorityWeight.toFixed(3)}</span>
            </label>

            <div className="order-list">
              {orders.map((order) => (
                <button
                  key={order.id}
                  className={`order-row ${
                    selectedOrderId === order.id ? "is-selected" : ""
                  }`}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <span>
                    <strong>{order.id}</strong>
                    {order.customer}
                  </span>
                  <small>P{order.priority}</small>
                </button>
              ))}
            </div>

            {selectedOrder && (
              <div className="editor">
                <h3>Editar pedido</h3>
                <label className="field">
                  Cliente
                  <input
                    value={selectedOrder.customer}
                    onChange={(event) =>
                      updateOrder(selectedOrder.id, "customer", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  CEP
                  <input
                    inputMode="numeric"
                    value={selectedOrder.zip_code || ""}
                    onChange={(event) =>
                      updateOrder(selectedOrder.id, "zip_code", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  Endereco
                  <textarea
                    value={selectedOrder.address || ""}
                    onChange={(event) =>
                      updateOrder(selectedOrder.id, "address", event.target.value)
                    }
                  ></textarea>
                </label>
                <button onClick={fillAddressFromCep}>Buscar pelo CEP</button>
                <button className="secondary" onClick={locateTypedAddress}>
                  Nao sei meu CEP
                </button>
                {lookupStatus && <p className="lookup-status">{lookupStatus}</p>}
                <label className="field">
                  Prioridade
                  <select
                    value={selectedOrder.priority}
                    onChange={(event) =>
                      updateOrder(selectedOrder.id, "priority", event.target.value)
                    }
                  >
                    <option value="1">Baixa</option>
                    <option value="2">Media</option>
                    <option value="3">Alta</option>
                  </select>
                </label>
                <button className="danger" onClick={removeSelectedOrder}>
                  Remover pedido
                </button>
              </div>
            )}
          </aside>

          <section className="map-panel">
            <div id="map" aria-label="Mapa com rota calculada"></div>
          </section>

          <aside className="panel">
            <div className="panel-header">
              <h2>Rota</h2>
              <span className="status">{status}</span>
            </div>

            <ol className="route-list">
              {route?.stops?.map((stop, index) => (
                <li key={stop.order.id}>
                  <span className="step">{index + 1}</span>
                  <div>
                    <strong>{stop.order.id}</strong>
                    <p>{stop.order.customer}</p>
                    {stop.order.address && <p>{stop.order.address}</p>}
                    <small>
                      trecho {stop.distance_from_previous.toFixed(4)} | acumulado{" "}
                      {stop.accumulated_distance.toFixed(4)}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
