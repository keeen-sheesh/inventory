import { UserCog, Settings, Store, ChefHat, Users, Coffee, Utensils } from 'lucide-react';
import { Link } from '@inertiajs/react';

export default function Welcome() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-blue-50">
            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="flex justify-center items-center gap-3 mb-4">
                        <Coffee className="w-12 h-12 text-amber-600" />
                        <h1 className="text-4xl font-bold text-gray-900">
                            CJ Brew & Dine
                        </h1>
                        <Utensils className="w-12 h-12 text-amber-600" />
                    </div>
                    <h2 className="text-3xl font-semibold text-gray-800">
                        Professional Restobar Management System
                    </h2>
                </div>

                {/* Role Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto mb-12">
                    <RoleCard 
                        title="Admin" 
                        description="Manage your admin, management for your address."
                        icon={UserCog}
                        color="bg-red-100"
                        iconColor="text-red-600"
                    />
                    <RoleCard 
                        title="Resto Admin" 
                        description="Manage your Restobar management for this resto admin."
                        icon={Settings}
                        color="bg-blue-100"
                        iconColor="text-blue-600"
                    />
                    <RoleCard 
                        title="Resto" 
                        description="Manage your restobar management for this resto promo."
                        icon={Store}
                        color="bg-green-100"
                        iconColor="text-green-600"
                    />
                    <RoleCard 
                        title="Kitchen" 
                        description="Manage your kitchen management for this kitchen order."
                        icon={ChefHat}
                        color="bg-yellow-100"
                        iconColor="text-yellow-600"
                    />
                    <RoleCard 
                        title="Customer" 
                        description="Enter the customer description for your customer."
                        icon={Users}
                        color="bg-purple-100"
                        iconColor="text-purple-600"
                    />
                </div>

                {/* Login/Register Buttons */}
                <div className="flex justify-center gap-4">
                    <Link
                        href="/login"
                        className="px-8 py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition shadow-lg"
                    >
                        Login
                    </Link>
                    <Link
                        href="/register"
                        className="px-8 py-3 border-2 border-amber-600 text-amber-600 rounded-lg font-semibold hover:bg-amber-50 transition shadow-lg"
                    >
                        Register
                    </Link>
                </div>
            </div>
        </div>
    );
}

function RoleCard({ title, description, icon: Icon, color, iconColor }) {
    return (
        <div className="bg-white rounded-xl shadow-xl p-6 hover:shadow-2xl transition-shadow">
            <div className={`${color} ${iconColor} w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4`}>
                <Icon className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                {title}
            </h3>
            <p className="text-sm text-gray-600 text-center leading-relaxed">
                {description}
            </p>
        </div>
    );
}