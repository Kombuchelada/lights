# Lumessa API — ASP.NET Core (net10.0) minimal API + SignalR ControlHub.
# Build context is the repo root (set RAILWAY_DOCKERFILE_PATH=server/Dockerfile
# on the Railway service). Only server/ is needed; there are no npm deps here.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY server/ ./server/
RUN dotnet restore server/Lumessa.sln
RUN dotnet publish server/Lumessa.Api/Lumessa.Api.csproj \
    -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./
# Bind IPv6 (`[::]`) so both the public Railway edge and the private
# *.railway.internal network (used by the front-end Caddy proxies) can reach it.
# Fixed port 8080 keeps the private origin stable: lights-server.railway.internal:8080
ENV ASPNETCORE_URLS=http://[::]:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Lumessa.Api.dll"]
