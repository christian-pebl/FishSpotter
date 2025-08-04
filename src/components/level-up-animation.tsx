"use client"

import { Trophy } from "lucide-react"

interface LevelUpAnimationProps {
    level: number;
}

export default function LevelUpAnimation({ level }: LevelUpAnimationProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="flex flex-col items-center gap-4 rounded-lg bg-background p-8 text-center shadow-2xl animate-scale-in">
                <Trophy className="h-24 w-24 text-yellow-400 drop-shadow-[0_4px_10px_rgba(250,204,21,0.5)]" />
                <h2 className="font-headline text-4xl font-bold text-primary">Level Up!</h2>
                <p className="text-2xl font-semibold text-foreground">You've reached Level {level}!</p>
                <p className="text-muted-foreground">Keep up the amazing work!</p>
            </div>
            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scale-in {
                    from { transform: scale(0.5); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
                .animate-scale-in {
                    animation: scale-in 0.4s 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
                }
            `}</style>
        </div>
    );
}
