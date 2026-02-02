
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  return (
   <div className="flex flex-col gap-4 ">
      <input type="text" placeholder="Search..." className="p-2 border rounded" />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Bem-vindo ao painel de controle.</p>
      </div>
   </div>
  );
}
