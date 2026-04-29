from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
DATA_FILE = BASE_DIR / "data" / "orders.json"
FRONTEND_DIR = PROJECT_DIR / "frontend"


class Point(BaseModel):
    id: str
    name: str | None = None
    customer: str | None = None
    zip_code: str | None = None
    address: str | None = None
    latitude: float
    longitude: float


class Order(Point):
    priority: int = Field(ge=1, le=3)
    max_delivery_minutes: int = Field(gt=0)


class RouteRequest(BaseModel):
    restaurant: Point
    orders: list[Order]
    priority_weight: float = Field(default=0.015, ge=0)


app = FastAPI(
    title="RouteFood API",
    description="MVP de roteirizacao de entregas inspirado em problemas logisticos do iFood.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def euclidean_distance(origin: Point, destination: Point) -> float:
    lat_delta = origin.latitude - destination.latitude
    lon_delta = origin.longitude - destination.longitude
    return math.sqrt(lat_delta**2 + lon_delta**2)


def route_score(origin: Point, order: Order, priority_weight: float) -> float:
    urgency_bonus = order.priority * priority_weight
    return euclidean_distance(origin, order) - urgency_bonus


def build_greedy_route(
    restaurant: Point, orders: list[Order], priority_weight: float
) -> dict[str, Any]:
    current: Point = restaurant
    pending = orders.copy()
    stops = []
    total_distance = 0.0

    while pending:
        next_order = min(
            pending,
            key=lambda order: route_score(current, order, priority_weight),
        )
        distance = euclidean_distance(current, next_order)
        total_distance += distance
        stops.append(
            {
                "order": next_order.model_dump(),
                "distance_from_previous": round(distance, 6),
                "accumulated_distance": round(total_distance, 6),
            }
        )
        current = next_order
        pending.remove(next_order)

    return {
        "algorithm": "greedy_nearest_neighbor_with_priority",
        "total_distance": round(total_distance, 6),
        "stops": stops,
    }


def read_orders_file() -> dict[str, Any]:
    if not DATA_FILE.exists():
        raise HTTPException(status_code=404, detail="Arquivo de pedidos nao encontrado.")

    with DATA_FILE.open(encoding="utf-8") as file:
        return json.load(file)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/orders")
def get_orders() -> dict[str, Any]:
    return read_orders_file()


@app.post("/api/route")
def calculate_route(payload: RouteRequest) -> dict[str, Any]:
    if not payload.orders:
        raise HTTPException(status_code=400, detail="Informe pelo menos um pedido.")

    route = build_greedy_route(
        payload.restaurant,
        payload.orders,
        payload.priority_weight,
    )
    return {
        "restaurant": payload.restaurant.model_dump(),
        **route,
    }


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
