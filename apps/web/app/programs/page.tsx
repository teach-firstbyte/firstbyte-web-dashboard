import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar, Users, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  allCategories,
  allTags,
  programsData,
  type Program,
} from "./programs-data";
import { ProgramsBrowser } from "./programs-browser";

// A server component: the header, every card and the detail sections are
// rendered to HTML here, and only ProgramsBrowser (search, filters, view
// toggle) runs in the browser.

function ProgramGridCard({ program }: { program: Program }) {
  return (
    <Card className="h-full overflow-hidden flex flex-col">
      <div className="relative h-48 overflow-hidden">
        <Image
          src={program.image}
          alt={program.title}
          width={500}
          height={300}
          className="object-cover transition-transform hover:scale-105 absolute inset-0 w-full h-full"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 p-4">
          <Badge className="mb-2">{program.category}</Badge>
          <h3 className="text-xl font-bold text-white">{program.title}</h3>
        </div>
      </div>
      <CardContent className="flex-1 pt-6">
        <p className="text-muted-foreground mb-4">{program.description}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {program.tags?.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {(program.tags?.length || 0) > 3 && (
            <Badge variant="outline" className="text-xs">
              +{(program.tags?.length || 0) - 3} more
            </Badge>
          )}
        </div>
        {program.details && (
          <div className="space-y-2 text-sm">
            {program.details.duration && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{program.details.duration}</span>
              </div>
            )}
            {program.details.ageRange && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{program.details.ageRange}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t">
        <Button variant="secondary" className="w-full" asChild>
          <Link href={`#${program.id}`}>Learn more</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function ProgramListRow({ program }: { program: Program }) {
  return (
    <Card className="overflow-hidden">
      <div className="md:flex">
        <div className="relative w-full md:w-48 h-40 md:h-auto overflow-hidden">
          <Image
            src={program.image}
            alt={program.title}
            width={500}
            height={300}
            sizes="(min-width: 768px) 192px, 500px"
            className="object-cover absolute inset-0 w-full h-full"
          />
        </div>
        <div className="p-6 flex-1">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
            <div>
              <Badge className="mb-2">{program.category}</Badge>
              <h3 className="text-xl font-bold">{program.title}</h3>
            </div>
            <div className="mt-4 md:mt-0">
              <Button variant="outline" size="sm" asChild>
                <Link href={`#${program.id}`}>Learn more</Link>
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground mb-4">{program.description}</p>
          <div className="flex flex-wrap gap-2">
            {program.tags?.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ProgramsPage() {
  return (
    <div className="py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/#programs"
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to homepage
          </Link>

          <h1 className="text-4xl font-bold mb-4">Our Programs</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Explore our comprehensive range of programs designed to inspire,
            educate, and empower the next generation of technology creators and
            innovators.
          </p>
        </div>

        <ProgramsBrowser
          programs={programsData}
          categories={allCategories}
          tags={allTags}
          gridCards={Object.fromEntries(
            programsData.map((program) => [
              program.id,
              <ProgramGridCard key={program.id} program={program} />,
            ]),
          )}
          listRows={Object.fromEntries(
            programsData.map((program) => [
              program.id,
              <ProgramListRow key={program.id} program={program} />,
            ]),
          )}
        />

        {/* Detailed program sections (hidden initially, shown when clicking Learn More) */}
        <div className="mt-16 space-y-20">
          {programsData.map((program) => (
            <div
              id={program.id}
              key={`detail-${program.id}`}
              className="scroll-mt-24"
            >
              <div className="grid md:grid-cols-2 gap-8 items-start">
                <div className="relative aspect-video overflow-hidden rounded-lg">
                  <Image
                    src={program.image}
                    alt={program.title}
                    width={500}
                    height={300}
                    className="object-cover absolute inset-0 w-full h-full"
                  />
                </div>
                <div>
                  <Badge className="mb-2">{program.category}</Badge>
                  <h2 className="text-3xl font-bold mb-4">{program.title}</h2>
                  <p className="text-lg mb-6">{program.longDescription}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {program.details?.duration && (
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Duration
                          </p>
                          <p className="font-medium">
                            {program.details.duration}
                          </p>
                        </div>
                      </div>
                    )}

                    {program.details?.ageRange && (
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Age Range
                          </p>
                          <p className="font-medium">
                            {program.details.ageRange}
                          </p>
                        </div>
                      </div>
                    )}

                    {program.details?.capacity && (
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Capacity
                          </p>
                          <p className="font-medium">
                            {program.details.capacity}
                          </p>
                        </div>
                      </div>
                    )}

                    {program.details?.location && (
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Location
                          </p>
                          <p className="font-medium">
                            {program.details.location}
                          </p>
                        </div>
                      </div>
                    )}

                    {program.details?.schedule && (
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Schedule
                          </p>
                          <p className="font-medium">
                            {program.details.schedule}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-8">
                    {program.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <Button size="lg" className="mb-2">
                    Apply Now
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Applications open for upcoming sessions
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
