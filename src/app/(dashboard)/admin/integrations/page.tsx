"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }> | string;
  status: "available" | "coming-soon";
  href?: string;
}

const integrations: IntegrationCard[] = [
  {
    id: "acuity",
    name: "Acuity Scheduling",
    description: "Sync appointment types, calendars, and availability from your Acuity account",
    icon: "/acuity.svg",
    status: "available",
    href: "/admin/integrations/acuity",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Connect your Google Calendar for seamless scheduling and availability management",
    icon: Calendar,
    status: "coming-soon",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get real-time notifications and updates directly in your Slack workspace",
    icon: "/slack.svg",
    status: "coming-soon",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect external services to enhance your booking portal experience
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Card 
            key={integration.id} 
            className={integration.status === "coming-soon" ? "opacity-75" : ""}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {typeof integration.icon === "string" ? (
                      <Image 
                        src={integration.icon} 
                        alt={integration.name}
                        width={24}
                        height={24}
                        className="w-6 h-6"
                      />
                    ) : (
                      <integration.icon className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{integration.name}</CardTitle>
                  </div>
                </div>
                <Badge 
                  variant={integration.status === "available" ? "default" : "secondary"}
                >
                  {integration.status === "available" ? "Available" : "Coming Soon"}
                </Badge>
              </div>
              <CardDescription className="mt-3">
                {integration.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {integration.status === "available" && integration.href ? (
                <Button asChild className="w-full">
                  <Link href={integration.href}>
                    Configure
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              ) : (
                <Button className="w-full" disabled>
                  Coming Soon
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}