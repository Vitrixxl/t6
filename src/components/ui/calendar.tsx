import type { ComponentProps } from 'react';
import { DayPicker } from 'react-day-picker';
import { fr } from 'react-day-picker/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export type CalendarProps = ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
    return (
        <DayPicker
            locale={fr}
            weekStartsOn={1}
            showOutsideDays
            className={cn('p-3', className)}
            classNames={{
                root: 'relative',
                months: 'flex flex-col gap-4',
                month: 'grid gap-2',
                month_caption: 'flex h-8 items-center justify-center',
                caption_label: 'font-display text-sm font-semibold capitalize',
                nav: 'absolute inset-x-0 top-3 flex items-center justify-between px-1',
                button_previous:
                    'grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40',
                button_next:
                    'grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40',
                month_grid: 'w-full border-collapse',
                weekdays: 'flex',
                weekday: 'w-9 pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground',
                week: 'flex',
                day: 'p-0.5 text-center',
                day_button:
                    'grid size-8 place-items-center rounded-lg text-[13px] font-medium transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected: '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:shadow-soft [&>button]:hover:bg-primary',
                today: '[&>button]:font-bold [&>button]:text-primary',
                outside: '[&>button]:text-muted-foreground/40',
                disabled: '[&>button]:pointer-events-none [&>button]:text-muted-foreground/30',
                hidden: 'invisible',
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation }) =>
                    orientation === 'left' ? (
                        <ChevronLeft className="size-4" aria-hidden="true" />
                    ) : (
                        <ChevronRight className="size-4" aria-hidden="true" />
                    ),
            }}
            {...props}
        />
    );
}
