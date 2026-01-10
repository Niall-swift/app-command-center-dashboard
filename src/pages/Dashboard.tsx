
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { get } from 'http';



interface IXCParams {
  qtype: string;
  query: string;
  oper: '=' | '>' | '<' | 'LIKE';
  page: string;
  rp: string;
  sortname: string;
  sortorder: 'asc' | 'desc';
}

export default function Dashboard() {
  // 2. Configurações iniciais
const host = 'https://coopertecisp.com.br/webservice/v1';

const selfSigned = true; // Equivale ao $selfSigned = true


function stringToBase64(str: string): string {
    const base64Chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let result = "";

    for (let i = 0; i < str.length; i += 3) {
      const chunk =
        (str.charCodeAt(i) << 16) |
        (str.charCodeAt(i + 1) << 8) |
        str.charCodeAt(i + 2);
      result +=
        base64Chars.charAt((chunk >> 18) & 0x3f) +
        base64Chars.charAt((chunk >> 12) & 0x3f) +
        base64Chars.charAt((chunk >> 6) & 0x3f) +
        base64Chars.charAt(chunk & 0x3f);
    }

    const padding = str.length % 3;
    if (padding === 1) {
      result = result.slice(0, -2) + "==";
    } else if (padding === 2) {
      result = result.slice(0, -1) + "=";
    }

    return result;
  }

  /// token da api
  const token =
    "29:ed30004f8207dbe08feb05005d67ea023793429a91210655cbf03fe12b1e4c94";
  const encodedToken = stringToBase64(token);


// 4. Execução da busca (Função Assíncrona)
async function getCliente() {
   const options = {
      method: "POST",
      url: `https://coopertecisp.com.br/webservice/v1/cliente`,
      headers: {
        Authorization: `Basic ${encodedToken}`,
        ixcsoft: "listar",
      },
      data: {
        qtype: "cliente.cnpj_cpf", // filtrando a conta pelo cnpj_cpf
        query: "194.524.067-98", // valor para consultar
        oper: "=", // operador
        page: "1", //página a ser mostrada
        rp: "1000", //quantidade de registros por página
        sortname: "cliente.id", //campo para ordenar a consulta
        sortorder: "desc", //ordenação (asc= crescente | desc=decrescente)
      },
      timeout: 15000, // 15 segundos timeout
    };

    try {
      const response = await axios(options);

      if (!response.data?.registros?.[0]) {
        throw new Error("Usuário não encontrado");
      }

      const userData = response.data.registros[0];
} catch (error) {
      console.error("Erro ao buscar cliente:", error);
    }
}

getCliente();


  

  return (
   <div className="flex flex-col gap-4 ">
      <input type="text" placeholder="Search..." className="p-2 border rounded" />
      <text>
        <h1>Dashboard</h1>
      </text>
   </div>
  );
}
