import React from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faGraduationCap,
} from "@fortawesome/free-solid-svg-icons";
import DetailMahasiswaKeabsenan from "./DetailMahasiswaKeabsenan";

const AkademikMahasiswa: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <FontAwesomeIcon
                            icon={faGraduationCap}
                            className="text-gray-500 dark:text-gray-400"
                        />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            Akademik
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Informasi Akademik
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Pantau rekapitulasi kehadiran Anda
                    </p>
                </motion.div>

                {/* Content */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <DetailMahasiswaKeabsenan isEmbedded={true} />
                </motion.div>
            </div>
        </div>
    );
};

export default AkademikMahasiswa;
