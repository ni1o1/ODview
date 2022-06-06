import React, {  Suspense } from 'react';
import Loadingpage from '@/pages/Loadingpage';
import Urbanmob from '@/pages/Urbanmob';

export default function App() {
    return (
        <div>
                <Suspense fallback={
                    <Loadingpage />}>
                    <Urbanmob />
                </Suspense>
        </div>);
}
